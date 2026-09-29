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

import { RedisClient } from '../middleware/redisCache';

export interface LeaderboardEntry {
  address: string;
  votes_cast: number;
  proposals_participated: number;
  total_weight_cast: number;
  rank: number;
}

const LEADERBOARD_CACHE_KEY = 'leaderboard:top50';
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Computes the top 50 voters by proposal participation count
 * Results are cached for 5 minutes
 */
export async function getLeaderboard(
  redisClient: RedisClient
): Promise<LeaderboardEntry[]> {
  // Try to get from cache first
  const cached = await redisClient.get(LEADERBOARD_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  // In production, this would query the indexer or database
  // For now, returning a stub that demonstrates the structure
  const leaderboard: LeaderboardEntry[] = [];

  // Cache the result
  await redisClient.setex(
    LEADERBOARD_CACHE_KEY,
    CACHE_TTL_SECONDS,
    JSON.stringify(leaderboard)
  );

  return leaderboard;
}

/**
 * Invalidates the leaderboard cache when vote data changes
 */
export async function invalidateLeaderboardCache(
  redisClient: RedisClient
): Promise<void> {
  await redisClient.del(LEADERBOARD_CACHE_KEY);
}

/**
 * Updates a voter's participation stats
 * This would be called by the indexer when processing votes
 */
export async function recordVote(
  redisClient: RedisClient,
  address: string,
  weight: number,
  proposalId: string
): Promise<void> {
  const key = `voter:${address}`;

  // Track votes cast
  await redisClient.hincrby(key, 'votes_cast', 1);

  // Track total weight
  await redisClient.hincrbyfloat(key, 'total_weight_cast', weight);

  // Track proposal participation (set to avoid duplicates)
  await redisClient.sadd(`voter:${address}:proposals`, proposalId);

  // Invalidate leaderboard cache since data changed
  await invalidateLeaderboardCache(redisClient);
}

/**
 * Retrieves vote history for a specific address
 */
export async function getVoterStats(
  redisClient: RedisClient,
  address: string
): Promise<{
  address: string;
  votes_cast: number;
  proposals_participated: number;
  total_weight_cast: number;
}> {
  const key = `voter:${address}`;
  const stats = await redisClient.hgetall(key);
  const proposalCount = await redisClient.scard(
    `voter:${address}:proposals`
  );

  return {
    address,
    votes_cast: parseInt(stats.votes_cast || '0', 10),
    proposals_participated: proposalCount,
    total_weight_cast: parseFloat(stats.total_weight_cast || '0'),
  };
}
