# Authentication & Roles — Phase 2

## Overview

Supabase Auth (GoTrue) is the single identity provider. The Express API never
stores passwords. Every request carries a Supabase access token; the backend
verifies it against Supabase, loads the matching `profiles` row, and enforces
role-based access. Row Level Security remains the second defense layer for
any anon-key access.

```
Client apps ──(Bearer JWT)──> Express API ──verify getUser(jwt)──> Supabase Auth
                                     └─service key─> Postgres (bypasses RLS, trusted code paths only)
```

## Roles (`profiles.role`)

| Role          | Sees                        | Notes                          |
|---------------|-----------------------------|--------------------------------|
| `admin`       | everything + staff mgmt     | creates staff accounts         |
| `manager`     | approvals, reports          |                                |
| `loan_officer`| loan pipeline, KYC review   |                                |
| `teller`      | cash transactions, savings  |                                |
| `client`      | own portal only             | `profiles.client_id` required  |

## Endpoints (`/api/v1/auth`)

| Method | Path                   | Auth        | Purpose |
|--------|------------------------|-------------|---------|
| POST   | `/client/signup`       | public      | Client self-registration; creates/links `clients` row (pending verification), provisions `profiles`, returns session |
| POST   | `/login`               | public      | Email+password → `{ accessToken, refreshToken, user }` |
| POST   | `/logout`              | bearer      | Revokes refresh token |
| GET    | `/me`                  | bearer      | Current profile + role |
| POST   | `/staff`               | admin       | Create staff account (email confirmed immediately) |
| PATCH  | `/staff/:userId/status`| admin       | Enable/disable account (also bans in GoTrue) |

Health: `GET /api/v1/health` (no auth) reports database reachability.

## Response envelope

```json
// success
{ "success": true, "data": { ... }, "meta": { ... } }
// failure
{ "success": false, "message": "Validation failed", "errorCode": "VALIDATION_ERROR",
  "details": [{ "path": "email", "message": "A valid email is required" }] }
```

## Setup

1. Create a **fresh** Supabase project (approved decision #1) and apply
   `database/migrations/0001..0010` in order (SQL Editor or psql).
2. `cp backend/.env.example backend/.env`, fill in URL + keys.
3. `cd backend && npm install && npm run dev` (port 4000 by default).
4. In Supabase Dashboard → Authentication → Providers: leave Email enabled;
   set *Confirm email* off during development so signup sessions return
   immediately.

## Smoke tests (no real project needed)

```powershell
# health
Invoke-RestMethod http://localhost:4000/api/v1/health

# missing token -> 401 AUTH_TOKEN_MISSING
Invoke-RestMethod http://localhost:4000/api/v1/auth/me

# invalid body -> 422 VALIDATION_ERROR
Invoke-RestMethod -Method Post http://localhost:4000/api/v1/auth/client/signup `
  -ContentType 'application/json' -Body '{"email":"bad"}'
```

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` is server-only; it bypasses RLS.
- Deactivation flips both `profiles.is_active` and GoTrue ban so banned users
  cannot refresh tokens.
- Audit rows are written to `audit_logs` for auth events (best-effort at API
  layer; DB triggers guarantee financial-table audits).
- Legacy root app still uses its own HMAC auth until Phase 14 replaces it.
