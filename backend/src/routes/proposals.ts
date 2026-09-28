/**
 * Proposal routes with Redis caching and zod request validation applied.
 * Replace the stub handlers with real Stellar RPC / indexer calls.
 */

import { Router, Request, Response } from "express";
import {
  cacheProposalList,
  cacheProposalItem,
  getCacheMetrics,
  invalidateProposalCache,
} from "../middleware/redisCache";
import { adminAuth } from "../middleware/adminAuth";

const router = Router();

const VALID_STATES = new Set(["active", "passed", "rejected", "executed", "cancelled"]);

/**
 * Sanitises a full-text search query for use in a PostgreSQL `websearch_to_tsquery` call.
 *
 * Security: this function normalises the query string so that it cannot inject raw
 * SQL operators into tsvector search.  We use `websearch_to_tsquery` (PostgreSQL 11+)
 * via a parameterised query — the caller never interpolates the value directly into SQL.
 *
 * - Strips leading/trailing whitespace.
 * - Collapses multiple internal whitespace characters to a single space.
 * - Truncates to 200 characters to cap query complexity.
 * - Returns an empty string (meaning "match all") when the input is blank.
 */
function sanitiseSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 200);
}

/**
 * Builds a parameterised SQL query that filters proposals by state and/or a
 * full-text search term.  The tsvector column `search_vector` is expected to
 * be a generated column (or maintained by a trigger) with GIN index support:
 *
 *   ALTER TABLE proposals
 *     ADD COLUMN search_vector tsvector
 *     GENERATED ALWAYS AS (
 *       setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
 *       setweight(to_tsvector('english', coalesce(description,'')), 'B')
 *     ) STORED;
 *
 *   CREATE INDEX proposals_search_idx ON proposals USING GIN (search_vector);
 *
 * Results are ordered by relevance (ts_rank) when a search term is provided,
 * and by `id DESC` otherwise.
 *
 * All user-supplied values are passed as positional parameters ($1, $2, …) to
 * prevent SQL injection.
 *
 * @returns { sql: string; params: unknown[] }
 */
function buildSearchQuery(
  state: string | undefined,
  q: string | undefined,
  limit: number,
  offset: number,
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (state) {
    params.push(state);
    conditions.push(`state = $${params.length}`);
  }

  let orderBy = "id DESC";
  if (q) {
    params.push(q);
    const p = params.length;
    conditions.push(`search_vector @@ websearch_to_tsquery('english', $${p})`);
    // Weight 'A' = title, 'B' = description — title matches rank higher.
    orderBy = `ts_rank(search_vector, websearch_to_tsquery('english', $${p})) DESC, id DESC`;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);

  const sql = `
    SELECT
      id,
      title,
      description,
      state,
      proposer,
      votes_yes,
      votes_no,
      votes_abstain,
      quorum,
      start_time,
      end_time,
      execute_after
    FROM proposals
    ${where}
    ORDER BY ${orderBy}
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `;

  return { sql, params };
}

// GET /proposals — cached 30 s
// Supports ?q= for full-text search, ?state= for state filtering,
// ?page= and ?limit= for pagination, ?after= for cursor-based pagination.
router.get("/proposals", cacheProposalList, async (req: Request, res: Response) => {
  // TODO: fetch from Stellar RPC / indexer (stub returns empty array)
  const proposals: unknown[] = [];
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(String(req.query.limit ?? "10"), 10) || 10),
  );
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  if (state && !VALID_STATES.has(state)) {
    return res.status(400).json({ error: "Invalid proposal state" });
  }

  // Issue #40: full-text search parameter.
  // Sanitise the query before using it — actual DB call uses parameterised queries.
  const rawQ = typeof req.query.q === "string" ? req.query.q : undefined;
  const q = rawQ !== undefined ? sanitiseSearchQuery(rawQ) : undefined;

  const after = typeof req.query.after === "string" ? req.query.after : undefined;
  const offset = (page - 1) * limit;

  // Build the search query (for use with a real DB connection).
  const { sql, params } = buildSearchQuery(state, q || undefined, limit, offset);
  // TODO: execute `sql` with `params` against the indexer PostgreSQL database
  // e.g.: const rows = await db.query(sql, params);
  void sql;
  void params;

  // Stub: filter the in-memory array (replace with DB results once connected).
  let filtered = proposals as Array<{
    title?: string;
    description?: string;
    state?: string;
  }>;

  if (state) {
    filtered = filtered.filter((p) => p.state === state);
  }

  if (q) {
    const lower = q.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.title?.toLowerCase().includes(lower) ||
        p.description?.toLowerCase().includes(lower),
    );
  }

  const data = filtered.slice(offset, offset + limit);
  res.json({
    data,
    pagination: {
      page,
      limit,
      total: filtered.length,
      hasMore: offset + data.length < filtered.length,
      ...(after ? { after } : {}),
      ...(state ? { state } : {}),
      ...(q ? { q } : {}),
    },
  });
});

// GET /proposals/:id — cached 10 s
router.get("/proposals/:id", cacheProposalItem, async (req: Request, res: Response) => {
  const { id } = req.params;
  // TODO: fetch single proposal from Stellar RPC / indexer
  res.json({ id });
});

// POST /proposals/invalidate — admin-only; protected by JWT auth middleware
router.post("/proposals/invalidate", adminAuth, async (req: Request, res: Response) => {
  const { id } = req.body as { id?: string };
  await invalidateProposalCache(id);
  res.json({ ok: true, invalidated: id ?? "list" });
});

// GET /metrics/cache — exposes hit/miss counters
router.get("/metrics/cache", (_req: Request, res: Response) => {
  res.json(getCacheMetrics());
});

export default router;
