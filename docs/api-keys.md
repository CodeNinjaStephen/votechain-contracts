# API Keys — Verified-DAO Tier

VoteChain's REST API is publicly accessible without authentication, but at reduced rate limits. **Verified-DAO API keys** unlock higher quotas for DAOs running high-activity governance events.

---

## Table of Contents

- [Overview](#overview)
- [Rate Limits](#rate-limits)
- [Registering for an API Key](#registering-for-an-api-key)
- [Using Your API Key](#using-your-api-key)
- [Key Management](#key-management)
  - [Create a Key](#create-a-key)
  - [List Keys](#list-keys)
  - [Get Key Status](#get-key-status)
  - [Rotate a Key](#rotate-a-key)
  - [Revoke a Key](#revoke-a-key)
- [Abuse Detection & Suspension](#abuse-detection--suspension)
- [Error Reference](#error-reference)
- [Security Notes](#security-notes)

---

## Overview

All API requests are served under two tiers:

| Tier | How to Activate | Read Limit | Write Limit |
|------|-----------------|------------|-------------|
| **Anonymous** | No action — default for all requests | 100 req / min | 10 req / min |
| **Verified-DAO** | Register an API key and pass it in the `Authorization` header | 1000 req / min | 100 req / min |

Rate limits are tracked per 60-second sliding window, separately for read and write operations.

---

## Rate Limits

### Read vs Write

Requests are bucketed by HTTP method:

| Bucket | Methods |
|--------|---------|
| Read | `GET`, `HEAD`, `OPTIONS` |
| Write | `POST`, `PUT`, `PATCH`, `DELETE` |

Each bucket has its own independent counter — exhausting your write quota does not affect your read quota.

### Rate-Limit Response Headers

Every API response includes these headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window |
| `X-RateLimit-Remaining` | Requests left before the limit is reached |
| `X-RateLimit-Reset` | Unix epoch seconds when the current window resets |
| `X-RateLimit-Tier` | Current tier: `anon` or `verified-dao` |

### When You Exceed the Limit

```
HTTP 429 Too Many Requests
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Limit: 1000 read requests per minute.",
    "details": [
      { "tier": "verified-dao", "limit": 1000, "remaining": 0, "resetAt": 1727681700 }
    ]
  }
}
```

Back off until `X-RateLimit-Reset` and retry. Implement exponential backoff with jitter for resilience.

---

## Registering for an API Key

API keys are issued by the VoteChain admin. This is an admin-only operation to ensure all verified keys correspond to legitimate DAOs.

**To request a key:**
1. Contact the VoteChain admin (see the contact in [SECURITY.md](../SECURITY.md)).
2. Provide your DAO identifier (e.g. `astro-dao`, `protocol-xyz`).
3. The admin will create a key using the management API (see below) and securely share the raw key with you.

**Store your key immediately** — the raw key is shown exactly once at creation and is not retrievable afterwards. If you lose it, the admin must rotate (replace) it.

---

## Using Your API Key

Pass the key in the `Authorization` header as a Bearer token:

```
Authorization: Bearer <your-api-key>
```

### Example: curl

```bash
curl https://api.votechain.dev/api/proposals \
  -H "Authorization: Bearer vc_dao_a3f8b2c1d4e5f6..."
```

### Example: JavaScript / TypeScript

```typescript
const response = await fetch("https://api.votechain.dev/api/proposals", {
  headers: {
    "Authorization": `Bearer ${process.env.VOTECHAIN_API_KEY}`,
    "Content-Type": "application/json",
  },
});
```

### Example: Axios

```typescript
import axios from "axios";

const client = axios.create({
  baseURL: "https://api.votechain.dev",
  headers: {
    Authorization: `Bearer ${process.env.VOTECHAIN_API_KEY}`,
  },
});

const { data } = await client.get("/api/proposals");
```

---

## Key Management

All management endpoints are **admin-only** — they require an admin JWT in the `Authorization` header. See [api-auth.md](api-auth.md) for how to obtain one.

### Create a Key

```
POST /api/keys
Authorization: Bearer <admin-jwt>
Content-Type: application/json
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `daoId` | string | Yes | Identifier for the DAO (1–128 characters) |
| `tier` | string | No | `"verified-dao"` (default and only current option) |

**Example:**

```bash
curl -X POST https://api.votechain.dev/api/keys \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "daoId": "astro-dao" }'
```

**Response: 201 Created**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "daoId": "astro-dao",
  "tier": "verified-dao",
  "createdAt": "2026-09-30T08:39:44.700Z",
  "rotatedAt": null,
  "revokedAt": null,
  "suspended": false,
  "suspendedAt": null,
  "rawKey": "a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
  "warning": "Store this key securely. It will not be shown again. Use POST /api/keys/:id/rotate to issue a replacement."
}
```

> **Important:** Copy the `rawKey` immediately. It is never stored in plaintext and cannot be retrieved again.

---

### List Keys

```
GET /api/keys
Authorization: Bearer <admin-jwt>
```

**Response: 200 OK**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "daoId": "astro-dao",
      "tier": "verified-dao",
      "createdAt": "2026-09-30T08:39:44.700Z",
      "rotatedAt": null,
      "revokedAt": null,
      "suspended": false,
      "suspendedAt": null
    }
  ],
  "total": 1
}
```

Raw key material is never included in list responses.

---

### Get Key Status

```
GET /api/keys/:id
Authorization: Bearer <admin-jwt>
```

**Response: 200 OK** — same shape as a single entry in the list above.

**Response: 404 Not Found** if the ID does not exist.

---

### Rotate a Key

Rotation replaces the existing key with a new one. The old key is **immediately invalidated** — any requests using it will receive `401 INVALID_API_KEY`. Use rotation to:

- Respond to a suspected key leak.
- Unsuspend a key after an abuse detection event.
- Perform routine credential hygiene.

```
POST /api/keys/:id/rotate
Authorization: Bearer <admin-jwt>
```

**Example:**

```bash
curl -X POST https://api.votechain.dev/api/keys/550e8400-e29b-41d4-a716-446655440000/rotate \
  -H "Authorization: Bearer $ADMIN_JWT"
```

**Response: 200 OK**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "daoId": "astro-dao",
  "tier": "verified-dao",
  "createdAt": "2026-09-30T08:39:44.700Z",
  "rotatedAt": "2026-10-01T10:00:00.000Z",
  "revokedAt": null,
  "suspended": false,
  "suspendedAt": null,
  "rawKey": "b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8",
  "warning": "The previous key is now invalid. Store this new key securely — it will not be shown again."
}
```

Rotation also clears any suspension — the new key starts fresh.

---

### Revoke a Key

Revocation permanently invalidates a key. It cannot be undone. Use it when a DAO no longer needs API access or when a key is known to be compromised and you do not want to re-issue.

```
DELETE /api/keys/:id
Authorization: Bearer <admin-jwt>
```

**Example:**

```bash
curl -X DELETE https://api.votechain.dev/api/keys/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $ADMIN_JWT"
```

**Response: 200 OK**

```json
{
  "ok": true,
  "revoked": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "daoId": "astro-dao",
    "tier": "verified-dao",
    "createdAt": "2026-09-30T08:39:44.700Z",
    "rotatedAt": null,
    "revokedAt": "2026-10-01T10:05:00.000Z",
    "suspended": false,
    "suspendedAt": null
  }
}
```

After revocation, requests using the old key receive `401 INVALID_API_KEY` — indistinguishable from an unknown key (no oracle for "was this once valid").

---

## Abuse Detection & Suspension

The abuse detection system monitors verified-DAO keys for anomalous traffic patterns. It runs passively — it does not block the triggering request — but will automatically suspend a key that shows repeated burst behaviour.

### How It Works

1. Request counts are tracked in 5-minute sliding windows per key.
2. Each window is compared to a rolling baseline of the previous 30 minutes.
3. A window is flagged as **anomalous** when:
   - The current window has ≥ 50 requests, **and**
   - Traffic is > 2× the rolling average.
4. After **3 consecutive anomalous windows** (15 minutes of sustained burst), the key is automatically suspended.

### Suspended Keys

A suspended key receives `403 SUSPENDED_KEY` on every subsequent request:

```json
{
  "error": {
    "code": "SUSPENDED_KEY",
    "message": "This API key has been suspended due to anomalous traffic. Rotate your key to resume access.",
    "details": []
  }
}
```

**To resume access:** the admin must rotate the key (`POST /api/keys/:id/rotate`). Rotation issues new key material and clears the suspension.

### What Triggers Anomaly Detection

- Sustained request rates more than double the key's historical average.
- Absolute traffic spikes exceeding 50 requests in a 5-minute window when no baseline exists.

### What Does Not Trigger It

- High but consistent traffic — if your DAO legitimately runs high-volume governance events regularly, the baseline adapts over 30 minutes and anomaly detection will not fire.
- Short bursts of < 50 requests, regardless of multiplier.
- Anonymous (unauthenticated) requests — abuse detection only applies to named keys.

---

## Error Reference

All errors share the shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": []
  }
}
```

| HTTP Status | `code` | Cause |
|-------------|--------|-------|
| `401` | `INVALID_API_KEY` | Key not found. Also returned for revoked keys (no oracle). |
| `403` | `SUSPENDED_KEY` | Key has been auto-suspended by abuse detection. Rotate to clear. |
| `429` | `RATE_LIMITED` | Quota exceeded. Check `X-RateLimit-Reset` and retry after. |
| `400` | `INVALID_DAO_ID` | The `daoId` field is missing or > 128 characters. |
| `404` | `KEY_NOT_FOUND` | The key ID does not exist (management endpoints). |
| `400` | `ROTATION_FAILED` | Rotation rejected (e.g. key already revoked). |

---

## Security Notes

1. **Never commit API keys.** Use environment variables or a secrets manager (GitHub Actions secrets, AWS Secrets Manager, Vault).
2. **Keys are single-use visible.** The raw key is shown exactly once at creation and once at rotation. Treat it like a password.
3. **Rotate proactively.** If you suspect exposure — even minor — rotate immediately.
4. **HTTPS only in production.** API keys transmitted over plain HTTP are visible in transit.
5. **Revoked vs expired.** Currently keys do not expire automatically. Rotation is the recommended hygiene practice — revoke only when access should be permanently terminated.
6. **Abuse detection is advisory.** Suspensions are based on statistical heuristics; legitimate high-volume events should not trigger them after the first 30 minutes of baseline accumulation. If you anticipate a known traffic spike, notify the admin in advance.
