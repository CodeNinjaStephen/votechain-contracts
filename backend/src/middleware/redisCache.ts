// Copyright 2024 VoteChain Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Redis caching middleware for VoteChain backend API.
 *
 * TTLs:
 *   - Proposal list  → 30 seconds
 *   - Single proposal → 10 seconds
 *
 * Cache-hit/miss metrics are tracked in memory and exposed via GET /metrics/cache.
 * Cache invalidation is triggered by calling invalidateProposalCache(id?).
 */

import { createClient, RedisClientType } from "redis";
import { Request, Response, NextFunction } from "express";
import { log } from "./requestTracing";

// ── Redis client ───────────────────────────────────────────────────────────

let redis: RedisClientType;

export function getRedis() {
  return redis;
}

export async function connectRedis(url = process.env.REDIS_URL ?? "redis://localhost:6379") {
  redis = createClient({ url }) as RedisClientType;
  redis.on("error", (err) => log("error", "redis error", { error: String(err) }));
  await redis.connect();
  log("info", "redis connected", { url });
}

/**
 * Returns true when the Redis client exists and its connection is open.
 * Used by the /ready health-check endpoint.
 */
export function isRedisReady(): boolean {
  return !!redis?.isOpen;
}

// ── Metrics ────────────────────────────────────────────────────────────────

const metrics = { hits: 0, misses: 0, invalidations: 0 };

export function getCacheMetrics() {
  const total = metrics.hits + metrics.misses;
  return {
    ...metrics,
    hitRate: total === 0 ? 0 : metrics.hits / total,
    missRate: total === 0 ? 0 : metrics.misses / total,
  };
}

// ── TTL constants ──────────────────────────────────────────────────────────

const TTL = {
  PROPOSAL_LIST: parseInt(process.env.PROPOSAL_LIST_TTL ?? '30', 10),
  PROPOSAL_ITEM: parseInt(process.env.PROPOSAL_ITEM_TTL ?? '10', 10),
};

// ── Cache key helpers ──────────────────────────────────────────────────────

const KEY = {
  list: (req: Request) => `proposals:list:${req.originalUrl}`,
  item: (id: string | number) => `proposals:item:${id}`,
};

// ── Middleware factory ─────────────────────────────────────────────────────

/**
 * Returns an Express middleware that caches the JSON response in Redis.
 * @param keyFn   Function that derives the cache key from the request.
 * @param ttl     TTL in seconds.
 */
function cacheMiddleware(keyFn: (req: Request) => string, ttl: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redis?.isOpen) return next();

    const key = keyFn(req);
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        metrics.hits++;
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Content-Type", "application/json");
        return res.send(cached);
      }
    } catch (err) {
      log("error", "redis get error", { error: String(err) });
    }

    metrics.misses++;
    res.setHeader("X-Cache", "MISS");

    // Intercept res.json to store the response in Redis
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const serialized = JSON.stringify(body);
      redis.setEx(key, ttl, serialized).catch((err) =>
        log("error", "redis setEx error", { error: String(err) })
      );
      return originalJson(body);
    };

    next();
  };
}

/** Middleware for GET /proposals — 30-second TTL */
export const cacheProposalList = cacheMiddleware((req) => KEY.list(req), TTL.PROPOSAL_LIST);

/** Middleware for GET /proposals/:id — 10-second TTL */
export const cacheProposalItem = cacheMiddleware(
  (req) => KEY.item(req.params.id),
  TTL.PROPOSAL_ITEM
);

// ── Cache invalidation ─────────────────────────────────────────────────────

/**
 * Invalidate cache entries.
 * - No argument: clears the proposal list cache.
 * - With id: clears both the list and the specific item cache.
 *
 * Call this from your event indexer when new on-chain events arrive.
 */
export async function invalidateProposalCache(id?: string | number) {
  if (!redis?.isOpen) return;
  const keys: string[] = [];
  for await (const key of redis.scanIterator({ MATCH: "proposals:list*" })) {
    keys.push(key);
  }
  if (id !== undefined) keys.push(KEY.item(id));
  try {
    await redis.del(keys);
    metrics.invalidations++;
    console.log("[redis] invalidated keys:", keys);
  } catch (err) {
    log("error", "redis del error", { error: String(err) });
  }
}
