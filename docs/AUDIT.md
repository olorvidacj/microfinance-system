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
| **U1** | KYC files publicly readable | **remains (needs your go-ahead)** | The code side is fixed: `initDb.ts` no longer runs any DDL at start-up, so nothing re-opens the bucket, and the server serves identity files only through short-lived signed links. The **live** bucket `kyc-documents` is still `public = true`, and on 2026-10-22 the anon key could still list it (one top-level folder). Migration `0018_private_kyc_document_bucket.sql` closes it; it has not been applied to production. |
| **U2** | Source files corrupted on disk | **remains (your decision)** | The 10 files in `shared/kyc/` are still the corrupted copies. Nothing imports them any more: `shared/kyc-core/` replaced them and is type-checked and tested. The Supabase copy of migration 0023 was restored. Delete `shared/kyc/` (or restore it from OneDrive history), and move the repository out of OneDrive or commit regularly. |
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
| Clients (list, create, profile, edit) | works, one gap remains | Branch-scoped; identity fields locked once KYC is submitted. **Remains:** a staff edit of a member's phone is not run through the shared phone validation and uniqueness check that self-service uses. |
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
| Legacy staff shell (`MainApp`, `LoanContext`) | works (unreachable) | A staff login without a branch-app role now sees "No role assigned". The old components (`src/context/LoanContext.tsx`, `src/components/*View.tsx`, `SupabaseModal.tsx`, ...) are no longer imported; delete them when convenient. |
| `GET /api/admin/roles` | works | Requires a staff login. |
| `/api/storage/*` | remains | Development fallback store (`uploads/`, used only when Supabase storage is unavailable): files are served without a login, named with a timestamp and about 31 random bits. KYC paths are refused. Serve these through signed links like KYC files before relying on the fallback anywhere shared. |
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
| Live database has no `schema_migrations` record; 0018 and 0023–0029 are not applied there | Read-only check on 2026-10-22: live has 0000–0016 and none of 0018, 0023–0029. After a backup, run `npm run db:migrate -- --baseline-through 0016_payment_proofs.sql --yes`: it records 0000–0016 as present and applies 0018 (private KYC bucket, U1), 0023–0028 and 0029 in order, one transaction each. Do not baseline through 0028: that would record 0018 as applied when it is not. Until then the server logs the pending files at start and the overdue and interest jobs fail on live. |
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

1. **U1** Apply `0018_private_kyc_document_bucket.sql` to production (makes the KYC bucket private).
2. **Live migrations**: `npm run db:migrate -- --baseline-through 0016_payment_proofs.sql --yes` after a backup; this also applies 0018 (item 1) (4.1).
3. **U2** Delete the corrupted `shared/kyc/` folder; move the repository out of OneDrive or commit.
4. **Superseded migrations** into `superseded/` folders, if you want `supabase db reset` to build the same database (4.1).
5. Branch **performance** charts on the portfolio module (3.2).
6. Branch **client edit** of a phone number: shared validation and uniqueness check (3.2).
7. **`/api/storage`** development fallback: signed links (3.4).
8. **16 legacy float columns** to `numeric` (4.2).
9. **Delete** the unreachable legacy shell components and `public/supabase_schema.sql` (served to anyone; schema only, no data).
10. Not audited: `/api/gemini/*`.
