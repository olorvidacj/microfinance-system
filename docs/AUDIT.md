# HOSCOMCO System Audit

First audit: 2026-10-20. **Re-verified: 2026-10-22**, after modules B1–B6 and the full end-to-end scenario.
Scope: client portal (`/portal`), mobile app (`mobile/`), branch staff app (`/staff/app`), admin console (`/admin`), `server.ts` + `src/routes/*`, Drizzle schema, `database/migrations` (and the `supabase/migrations` copies), live Supabase project (read-only checks only).

## How to read this

**Status** in the module tables:

- **works**: the feature goes through the service that owns the rule (state machine, branch scope, exact money, ledger, audit, notification, idempotency), and it was exercised end to end on a database built from migrations (see [How it was verified](#how-it-was-verified)) or covered by a database test.
- **remains**: something is still open; the reason and what would close it are given in the row and collected in [What remains](#what-remains).

Every row of the first audit is accounted for: it now reads **works**, or it is listed under **remains** with the reason.

## How it was verified

| Check | Result |
|---|---|
| Full scenario on a fresh database (`database/migrations` in `APPLY_ORDER.txt` order + `seed.ts`): register A, B, C; verify KYC; form a group; savings accounts and deposits; a group loan each with the others' consent; approve and release; A pays on time; B pays part and goes 10 days overdue; the penalty is charged; the solidarity fund covers B; B repays the group; A pays off and A's loan closes | **60/60 checks pass** (phase 1: 16, phase 2: 19, browser: 13, database: 12) |
| Trial balance after the scenario | debits ₱76,444.00 = credits ₱76,444.00, difference **₱0.00**; every journal entry balances on its own; GL 2010 = member savings (₱10,500.50); GL 2040 = solidarity fund (₱9,000.00) |
| Same numbers on every surface | outstanding ₱19,570.00, savings ₱10,500.50, collected ₱17,604.50, fund ₱9,000.00: identical in the admin reports and overview, the branch dashboard and branch reports, and the sum of the three members' portals (API and on screen) |
| Client self-service (B6) | 60/60 API checks and 51/51 browser checks: web portal and mobile app (web build) show the same member numbers at 390 px, every screen loads, actions work, no console errors or failed requests |
| Cross-member access | 13 database tests (`src/client/isolation.db.test.ts`) and 13 HTTP attempts: every other member's loan, schedule, payoff, receipt, statement, withdrawal request, document, notification, transaction and group consent answers 404/403; a staff login cannot use the member API; a member cannot use the branch API |
| Live Supabase with only the anon key (read-only) | 0 of 42 public tables and views readable; no table or view is granted to `anon` or `authenticated`; storage: see U1 |
| `npm run db:verify` | a database built from the migrations alone has every table and column the code declares (44 tables, 758 columns) |

## 1. Act now: live exposures

| # | Finding | Status | Detail |
|---|---|---|---|
| **U1** | KYC files publicly readable | **works** | Migration 0018 was applied to production on 2026-10-22: `kyc-documents` is private and the anon key lists nothing. The server no longer runs DDL at start-up, so nothing re-opens it; identity files are served only through short-lived signed links. **The `documents` bucket** (checked read-only on 2026-10-23: `public = true`, 0 objects, no storage policies; nothing in the code reads or writes it, and no stored row points into it) is made private by migration [0031](../database/migrations/0031_private_documents_bucket.sql), which also drops any policy opening it and refuses to finish while any bucket is public. Branch and member document links now come from one helper, [documentLinks.ts](../src/db/documentLinks.ts): always signed now from the storage path (10 minutes). Before, 6 older rows handed out the expired signed link saved at upload, and the branch route never read `storage_path`. A link into another bucket is refused. Tests: [storageBuckets.db.test.ts](../src/db/storageBuckets.db.test.ts), [documentLinks.test.ts](../src/db/documentLinks.test.ts), [isolation.db.test.ts](../src/client/isolation.db.test.ts). **Remains:** apply 0031 to production. |
| **U2** | Source files corrupted on disk | **works** | The 10 corrupted, never-committed files in `shared/kyc/` were deleted on 2026-10-22; nothing imported them (the web app, server and mobile app use `shared/kyc-core/`, type-checked and tested). The Supabase copy of migration 0023 was restored earlier. Work is now committed regularly; moving the repository out of OneDrive is still advisable. |
| **U3** | Account takeover by phone-number matching | **works** | Auto-linking by phone suffix is gone ([clientProvisioning.ts:175](../src/db/clientProvisioning.ts#L175)); a login is linked to a member only by verified email, and registration creates the member in the same transaction. |
| **U4** | Unassigned branch staff saw every branch | **works** | All-branch access now comes only from the `view_all_records` permission; staff without it and without a branch get 403 ([branchRoutes.ts](../src/routes/branchRoutes.ts) `requireBranch`). |
| **U5** | Every staff role could read all-branch data through the admin API | **works** | The admin read gate is now `view_all_records` only ([server.ts](../server.ts) `ADMIN_READ_ANY`); a teller gets 403 (checked in the scenario). The admin console screens require the same permission ([admin/router.tsx](../src/admin/router.tsx)). |

## 2. Command results (2026-10-22)

| Command | Result |
|---|---|
| `npm run lint` (`tsc --noEmit`) | passes, 0 errors (includes `shared/`) |
| `npm test` (Vitest) | passes: 30 files, 313 tests (including the member-isolation, migration-runner and ledger-immutability database tests) |
| `npm run build` | passes (Vite warns that the main bundle is 2.7 MB; code-splitting is a follow-up, not an error) |
| `mobile/`: `npx tsc --noEmit` | passes, 0 errors |
| `npm run db:verify` | passes: 44 tables, 758 columns |
| Unauthenticated `GET /api/admin/roles` | 401 (it now requires a staff login) |

## 3. Module tables

### 3.1 Client portal and mobile app (`/portal/*`, `mobile/`, API prefix `/api/client`)

The web portal and the mobile app call the same endpoints and share the response types (`shared/client/contracts.ts`), formatting, validation and calculators (`shared/`).

| Feature | Status | Notes |
|---|---|---|
| Registration | works | Email ownership verified by code; the member record is created with the login; no phone-based linking (U3). |
| Login / forgot / reset password | works | Codes are Supabase email OTPs (no in-process store). A reset changes both credential stores. Password strength rules are shared by web, mobile and server. |
| Change password | works | Current password required; strength rules shared; audited. |
| Dashboard | works | One call (`/dashboard`) shared by web and mobile; exact amounts. |
| Profile (view, edit) | works | Identity fields are locked once KYC is underway; contact and work details validated by the shared rules; no generated third-party avatar URLs. |
| KYC wizard | works | One form model and payload for web and mobile (`shared/client/kycForm.ts`), checked with the server's own rules; prefilled from the member record including PSGC codes; server-side state machine refuses resubmitting an approved application. |
| Loan products, calculator, application | works | Product rules, KYC gate and idempotency enforced by the server. |
| My loans, detail, schedule, payoff | works | Ownership checked on every id. |
| Payment history and receipts | works | Official receipts are the server's documents. |
| Payment proof | works | Branch queue (`/staff/app/payment-proofs`) claims, verifies or rejects; only verification posts a payment. |
| Savings, statements, withdrawal requests | works | A request moves no money until a teller releases it; statements export the same CSV on web and mobile. |
| Transactions | works | Read from the register every money movement writes; kind filter, period filter and CSV export shared by web and mobile. |
| My group | works | Members' standing (not their amounts), consent requests, fund covers owed, meetings. |
| Notifications | works | Member feed (`audience = CLIENT`); mark-read is scoped to the member; unread count is exact. |
| Documents | works | Real list; files open through short-lived links scoped to the member. |
| Settings | works | Password change and real sign-in history (no invented sessions or preferences). |
| Help & support | works | FAQs; the member's own branch contact from `branches`; messages stored and visible to the branch, with "seen" status. |

### 3.2 Branch staff app (`/staff/app/*`, API prefix `/api/branch`)

| Feature | Status | Notes |
|---|---|---|
| Branch context & assignment | works | U4 fixed. |
| Dashboard | works | Figures from `src/reports/portfolio.ts` (exact; same as admin and portal). The invented ₱150,000 "daily target" was removed. "Today" is the Manila date (it was the UTC date, a day behind until 8 a.m.). |
| Performance | remains | Charts sum payments as JavaScript numbers by UTC week; display only, no money moves. Move to the portfolio module like the dashboard. |
| Clients (list, create, profile, edit) | **works** | Branch-scoped. A staff edit ([staffEdit.ts](../src/members/staffEdit.ts)) runs one transaction: (1) 404 for a member outside the branch, even when only notes are sent; (2) only fields that actually change are checked and saved, by the same shared rules as self-service ([profile.ts](../shared/kyc-core/profile.ts) `validateStaffMemberEdit`); (3) identity fields are locked while the KYC is submitted, under review, approved or suspended, but unchanged values sent by the form no longer block other edits; (4) the phone (by its 10-digit key) and email must be unused by every other login and member (409 with a field message); (5) the member's login changes with them, and the Supabase Auth email too when configured (a refusal rolls back everything); (6) the audit log records the old and new phone and email. Income and expenses are validated as exact decimals (the columns are still floats: 4.2). The duplicate `normalizePhilippinePhone` is gone; the shared `normalizePhilippineMobile` is the one rule. The branch form shows each field's message and uses the shared choice lists. Tests: [staffEdit.db.test.ts](../src/members/staffEdit.db.test.ts); end to end 10/10, including sign-in with the new number. |
| KYC queue & review | works | Claim/release and decisions go through the KYC state machine with audit. |
| Loan applications, review, approval, disbursement | works | `src/lending/service.ts`: product rules, state machine, group consent, idempotent release with ledger entry, audit and notification. |
| Collections today | works | Posted payments only, exact sums. |
| Record repayment, reversal | works | `src/lending/repayment.ts`: atomic, ledgered, idempotent; reversal needs a second person. |
| Payment-proof queue | works | Page and endpoints in use. |
| Savings accounts, deposits, withdrawals, requests | works | `src/savings/service.ts`. |
| Groups, membership, meetings, collections, fund covers | works | `src/groups/service.ts` (B5); exercised in the scenario. |
| Transaction register | works | Read-only. The "Record transaction" form and `POST /api/branch/transactions`, which inserted arbitrary rows into the register members' histories read, were removed. Sums are exact; the date filter works. |
| Documents | works | Branch-scoped. |
| Notifications | works | Staff feed only (`audience = STAFF`). |
| Reports | works | Portfolio, overdue, collections and savings from the portfolio module and posted payments (reversed payments excluded); exact decimal strings. |
| Activity log, personnel profile | works | — |

### 3.3 Admin console (`/admin/*`, API prefix `/api/admin`)

| Feature | Status | Notes |
|---|---|---|
| Console access gate | works | Requires a staff login with `view_all_records`; the session-flag shortcut was removed. |
| Login | works | — |
| Dashboard | works | Savings, members, KYC and group counts from the portfolio module. |
| Users | works | `manage_users`; a staff account always has a role. |
| Clients, loans, savings, transactions, groups, branches, audit logs, notifications | works | Read-only, all branches, `view_all_records` (U5). List amounts are displayed with centavos. |
| KYC | works (question for you) | List only; decisions are made in the branch app. Confirm that is intended. |
| Reports | works | Rebuilt on the portfolio module: exact amounts, per-branch figures, a ledger-balanced badge driven by the real trial balance, real CSV export and print. Removed: invented figures ("1.0% dividend", "average turnaround —"), fake Excel/PDF exports, an unsubstantiated "CDA & BSP compliant" badge, and date pickers that filtered nothing. |
| Loan and savings products | works | Validated by `shared/lending`. |
| System settings | works | The page showed placeholders (TIN 123-456-789-000) and its Save only showed a toast; the backend kept an unused in-memory object describing another cooperative. Both removed; the page now links to where each rule actually lives and shows the KYC document requirements from the database. |
| Sensitive-operation approval | works (removed) | `POST /api/admin/approve-sensitive` answered "approved" without recording anything; removed. Sensitive actions are authorised inside the services that perform them. |
| Password reset | works | `sendPasswordReset` uses the non-enumerating reset endpoint. |

### 3.4 Legacy `server.ts` API

| Endpoint | Status | Notes |
|---|---|---|
| `PUT /api/loans/:id`, `POST /api/payments`, `/api/solidarity-groups` | works (removed earlier) | Replaced by the lending, repayment and group services. |
| `GET/POST/PUT /api/borrowers`, `GET /api/loans` | works (removed) | Raw-body writes and unscoped lists; no callers. |
| `/api/financial-transactions` (list, insert, reverse, status, delete) | works (removed) | Raw register inserts, status overrides and "reversals" that never moved a balance. |
| `/api/db/all`, `/api/db/seed`, `/api/db/test-connection` | works (removed) | Full dump to any staff login; seeding by any staff; connection to an arbitrary database string. Seeding is `npm run db:seed` and server start. |
| Legacy staff shell (`MainApp`, `LoanContext`) | **removed** | Deleted on 2026-10-23 after tracing every import (static, re-export, dynamic, require) from the real entry points: `index.html` → `src/main.tsx`, `server.ts`, `vite.config.ts`, `scripts/` and `mobile/App.tsx`. 48 unreachable files went: the old staff shell (`LoanContext.tsx`, 35 `src/components/*View/Modal` files, `components/portal/*`, `components/auth/AuthHeader.tsx`, `useAccess.ts`, `auth.types.ts`, `lib/supabase.ts`), 3 unused branch and admin components, `src/db/drizzle.config.ts`, and `mobile/src/lib/supabase.ts` (an unused client with a hard-coded anon key). Also deleted: `public/supabase_schema.sql` (served to anyone), the root `supabase_schema.sql`, and `scripts/run-full-schema.mjs` (it replayed that September dump against `DATABASE_URL`; `npm run db:migrate` replaces it). `GET /supabase_schema.sql` is now 404 on the dev server and the built app: a missing file is no longer answered with `index.html` in [server.ts](../server.ts). Checked: lint, 427 tests, build, mobile typecheck; the portal, branch app and admin console sign in and load 20 pages on both servers with no unexpected console errors. Found during that check and fixed: the branch dashboard requested loan applications for roles that cannot read them, and the loan calculator (open to all staff) could not load product terms for client-services staff. |
| `GET /api/admin/roles` | works | Requires a staff login. |
| `/api/storage/*` | **works** | Local branch-document files (`uploads/`) are served only through signed links that expire after 10 minutes: an HMAC-SHA256 token over the path and expiry ([localFiles.ts](../src/db/localFiles.ts), [storageRoutes.ts](../src/routes/storageRoutes.ts); secret `FILE_LINK_SECRET`, else `AUTH_SECRET`). No token, or an old raw path: 401. A forged, tampered or expired token, or a KYC-store token: 403. A path outside `uploads/` or under `kyc/`, even when correctly signed: 404. Links come from the same helper as Supabase ([documentLinks.ts](../src/db/documentLinks.ts)), only after the branch-scope or ownership check; old rows storing `/api/storage/<path>` are re-signed. New files get `crypto.randomUUID()` names. In production a Supabase failure fails the upload unless `ALLOW_LOCAL_FILE_STORAGE=true` ([documentStorage.ts](../src/db/documentStorage.ts)). Tests: [storageRoutes.test.ts](../src/routes/storageRoutes.test.ts), [documentStorage.test.ts](../src/db/documentStorage.test.ts), [documentLinks.test.ts](../src/db/documentLinks.test.ts); over HTTP, another branch and another member get 404 (13/13). Payment proofs and loan and KYC files were already signed (`/api/kyc/files/<token>`). |
| `/api/gemini/*` | remains | Not audited. |

## 4. Schema

### 4.1 One schema, built from migrations

- A database is built from `database/migrations` alone: `npm run db:migrate` applies the files listed in `database/migrations/APPLY_ORDER.txt` in order, one transaction each, recorded in `schema_migrations`; `npm run db:seed` (also run at server start) adds the bootstrap administrator and configuration. Tests and end-to-end runs build their databases the same way.
- `0000_application_baseline.sql` holds the tables `src/db/initDb.ts` used to create at every start; the server now only reports pending migrations and creates nothing.
- `0029_ledger_immutable.sql`: posted journal entries and lines can no longer be updated, deleted or truncated (the balance trigger allowed deleting every line of an entry).
- Drizzle matches the migrated database (`npm run db:verify`). The 37 `financial.*` / `oversight.*` Drizzle tables, which no migration created and no code used, were removed.

| Remaining | Why |
|---|---|
| Superseded migrations 0003–0010, 0017, 0019–0022 are still in the folders | They are listed as skipped (with reasons) in `APPLY_ORDER.txt`, so `db:migrate` never runs them, but `supabase db reset` would. Moving them into a `superseded/` folder was blocked by the tool's permission check; it is your call. |
| Production migrations | **Done 2026-10-22.** After a full backup (`database/backups/full-20261021-223445`, plus storage buckets and policies), `npm run db:migrate -- --baseline-through 0016_payment_proofs.sql --yes` recorded 0000–0016 and applied 0018, 0023–0028 and 0029, one transaction each; `db:migrate --status` reports 17 applied, 0 pending. Every pre-existing row was kept: the only count changes are the ones the migrations make (4 ledger accounts added; existing savings balances posted to the ledger as 10 opening transactions and 2 journal entries; the old `savings_products` table renamed `legacy_savings_products` with its 2 rows). GL 2010 = ₱144,550.00 = the 25 savings accounts; GL 2040 = ₱14,500.00; debits = credits. |
| Rollbacks exist for 0000 and 0023–0029 only | 0001–0022 predate the rule. |

### 4.2 Money column types

All ledger, loan, schedule, payment, savings and fund money columns are `numeric` (67 columns). **Remains:** 16 `double precision` columns on legacy descriptive or cached fields: `borrowers` (monthly_income, monthly_expenses, savings_balance, share_capital, total_borrowed, total_repaid), `branches` (active_disbursed_pool, cash_vault_balance), `interest_credit_logs`, `member_follow_up_logs`, `membership_applications`, `solidarity_groups` (repayment_rate, total_active_loans, total_group_savings). None is used to move money; `borrowers.savings_balance` is a cache rewritten from the exact account balances. Convert them in a migration.

## 5. The fix rules, now

| Rule | State |
|---|---|
| Exact money | Met for every money movement and every report (integer cents in code, decimal strings in APIs, `numeric` in the database). Legacy float columns: 4.2. |
| Atomic money movement | Met: one transaction per movement, with row locks. |
| Double-entry ledger | Met: every loan release, repayment, penalty, reversal, savings movement and fund movement posts a balanced journal entry; the trial balance is zero after the full scenario; posted entries are immutable (0029). |
| Audit, notification, idempotency on every movement | Met in the money services. |
| Server-side state machines | Met for loans, KYC, savings accounts and requests, payment proofs and groups. |
| Authorization and branch scope | Met (U3–U5 fixed; raw legacy routes removed; member isolation tested). |
| RLS | No table or view is granted to `anon` or `authenticated`; the server connects as the owner. Storage: U1. |
| Shared validation (`shared/`) | Met: lending, savings, groups, KYC, profile, support, passwords, transactions and formatting are shared by server, web and mobile. |
| No fake data in production paths | Met. Removed in this round: invented contact numbers, admin system settings, report figures and exports, the branch daily target, the mobile demo-login hint, fake document downloads, and the approve-sensitive endpoint. |

## What remains

1. Apply migration 0031 to production so the `documents` storage bucket is private (U1; the code side is done).
2. **Superseded migrations** into `superseded/` folders, if you want `supabase db reset` to build the same database (4.1).
3. Branch **performance** charts on the portfolio module (3.2).
6. **16 legacy float columns** to `numeric` (4.2).
8. Not audited: `/api/gemini/*`.
