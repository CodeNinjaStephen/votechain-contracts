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
 * API key authentication and per-tier rate-limiting middleware.
 *
 * Behaviour:
 *   1. If no Authorization header is present the request proceeds as "anon"
 *      with the lower default rate limits (100 read / 10 write per minute).
 *   2. If `Authorization: Bearer <key>` is present:
 *      a. The key is looked up by its SHA-256 hash.
 *      b. Revoked keys → 401 REVOKED_KEY
 *      c. Suspended keys → 403 SUSPENDED_KEY
 *      d. Valid keys → resolved tier applied (currently "verified-dao")
 *   3. Rate limits are enforced per (keyId|ip) × (read|write) window via Redis
 *      when available, or an in-memory fallback map when Redis is down.
 *
 * The resolved tier and key ID are attached to the request:
 *   req.apiKeyTier  — "anon" | "verified-dao"
 *   req.apiKeyId    — string | undefined
 *
 * Rate-limit headers set on every response:
 *   X-RateLimit-Limit     — window maximum for this tier+method
 *   X-RateLimit-Remaining — requests left in the current window
 *   X-RateLimit-Reset     — Unix epoch seconds when the window resets
 *   X-RateLimit-Tier      — "anon" | "verified-dao"
 */

import { Request, Response, NextFunction } from "express";
import { lookupByRawKey, TIER_LIMITS, ApiKeyTier } from "./apiKeyStore";
import { getRedis } from "./redisCache";
import { log } from "./requestTracing";

// ── Augment Express Request ────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      apiKeyTier?: ApiKeyTier;
      apiKeyId?: string;
    }
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

const WINDOW_SECONDS = 60;

/** HTTP methods treated as "write" operations for rate-limit bucketing. */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ── In-memory fallback rate limiter ───────────────────────────────────────

interface MemEntry {
  count: number;
  resetAt: number; // Unix epoch ms
}

const memLimiter = new Map<string, MemEntry>();

function memIncr(key: string): { count: number; resetAt: number } {
  const now = Date.now();
  const windowMs = WINDOW_SECONDS * 1000;
  let entry = memLimiter.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    memLimiter.set(key, entry);
  } else {
    entry.count += 1;
  }
  return { count: entry.count, resetAt: entry.resetAt };
}

// ── Rate-limit counter (Redis-first, memory fallback) ─────────────────────

async function increment(key: string): Promise<{ count: number; resetAt: number }> {
  const redis = getRedis();
  if (redis?.isOpen) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, WINDOW_SECONDS);
      const ttl = await redis.ttl(key);
      const resetAt = Math.ceil(Date.now() / 1000) + Math.max(ttl, 0);
      return { count, resetAt };
    } catch (err) {
      log("warn", "apiKeyAuth redis error — falling back to memory limiter", {
        error: String(err),
      });
    }
  }
  // Memory fallback: resetAt in epoch seconds for header consistency
  const result = memIncr(key);
  return { count: result.count, resetAt: Math.ceil(result.resetAt / 1000) };
}

// ── Middleware ─────────────────────────────────────────────────────────────

/**
 * Resolves the caller's API key tier and enforces per-tier rate limits.
 * Always calls next() unless the limit is exceeded or the key is invalid.
 */
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  let tier: ApiKeyTier = "anon";
  let limiterId: string = req.ip ?? "unknown";

  // ── Step 1: Resolve tier from Bearer key ──────────────────────────────

  if (authHeader?.startsWith("Bearer ")) {
    const rawKey = authHeader.slice("Bearer ".length).trim();

    const record = lookupByRawKey(rawKey);

    if (!record) {
      res.status(401).json({
        error: {
          code: "INVALID_API_KEY",
          message: "API key not found or invalid",
          details: [],
        },
      });
      return;
    }

    if (record.revokedAt) {
      res.status(401).json({
        error: {
          code: "REVOKED_KEY",
          message: "This API key has been revoked",
          details: [],
        },
      });
      return;
    }

    if (record.suspended) {
      res.status(403).json({
        error: {
          code: "SUSPENDED_KEY",
          message: "This API key has been suspended due to anomalous traffic. Rotate your key to resume access.",
          details: [],
        },
      });
      return;
    }

    tier = record.tier;
    limiterId = `apikey:${record.id}`;
    req.apiKeyId = record.id;
  }

  req.apiKeyTier = tier;

  // ── Step 2: Determine read/write bucket and limits ────────────────────

  const isWrite = WRITE_METHODS.has(req.method.toUpperCase());
  const bucket = isWrite ? "write" : "read";
  const limits = TIER_LIMITS[tier];
  const maximum = isWrite ? limits.writePerMinute : limits.readPerMinute;

  const rateLimitKey = `rate-limit:${limiterId}:${bucket}`;

  // ── Step 3: Increment counter and enforce limit ───────────────────────

  const { count, resetAt } = await increment(rateLimitKey);
  const remaining = Math.max(0, maximum - count);

  res.setHeader("X-RateLimit-Limit", maximum);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", resetAt);
  res.setHeader("X-RateLimit-Tier", tier);

  if (count > maximum) {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: `Rate limit exceeded. Limit: ${maximum} ${bucket} requests per minute.`,
        details: [{ tier, limit: maximum, remaining: 0, resetAt }],
      },
    });
    return;
  }

  next();
}
