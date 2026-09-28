/**
 * Health and readiness endpoints for VoteChain backend.
 *
 * GET /health  — liveness probe: always 200 while the process is running
 * GET /ready   — readiness probe: 200 when all dependencies (Redis) are up,
 *                503 when any dependency is unavailable
 *
 * These routes are intentionally mounted BEFORE rate-limiting and auth
 * middleware so that load balancers and orchestrators can always reach them.
 */

import { Router, Request, Response } from "express";
import { isRedisReady, getCacheMetrics } from "../middleware/redisCache";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require("../../package.json") as { version?: string };

const router = Router();

/**
 * GET /health
 *
 * Liveness probe — confirms the Node.js process is alive.
 * Always returns 200 as long as the process can handle requests.
 */
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    version: version ?? "1.0.0",
  });
});

/**
 * GET /ready
 *
 * Readiness probe — confirms all dependencies are healthy.
 * Returns 200 { status: "ready" } when Redis is connected.
 * Returns 503 { status: "unavailable", checks: { redis: false } } otherwise.
 */
router.get("/ready", (_req: Request, res: Response) => {
  const redisUp = isRedisReady();

  if (redisUp) {
    return res.status(200).json({ status: "ready" });
  }

  return res.status(503).json({
    status: "unavailable",
    checks: { redis: false },
  });
});

/**
 * GET /metrics/cache
 *
 * Exposes Redis cache hit/miss counters and current Redis connectivity. (#38)
 * The redis_up field is false when Redis is unreachable and caching is degraded.
 */
router.get("/metrics/cache", (_req: Request, res: Response) => {
  res.status(200).json(getCacheMetrics());
});

export default router;
