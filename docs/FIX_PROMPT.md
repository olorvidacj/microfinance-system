# Prompt: Make the Client Services & Financial Transaction Subsystem Fully Functional

> How to use: paste **Part A (Master Prompt)** once at the start of a session.
> Then paste **one Part B module prompt at a time**, in the order given.
> Don't move to the next module until the current one passes its "Done when" checklist.

---

## Part A — Master Prompt (paste first)

You are working in my microfinance system. It's an existing codebase. Most modules
are partly built but don't work end-to-end. Your job is to make my subsystem,
**Client Services & Financial Transaction**, fully functional. Work module by module.
Fix and finish what's already there. Don't rewrite from scratch.

### The stack (check it before changing anything)
- **Web app:** React 19 + Vite + Tailwind 4 + react-router-dom 7, in `src/`.
  There are three surfaces:
  - `src/admin/` is the head-office admin.
  - `src/branch/` is branch staff: loan officers and tellers.
  - `src/portal/` is the client self-service portal.
  - `src/components/*View.tsx` holds older legacy views. Find out which of them are
    still routed. Delete or replace dead duplicates. Don't fix two copies of one screen.
- **API:** Express in `server.ts`, about 3,600 lines. Also check `backend/src`.
- **Database:** Postgres through Supabase, with Drizzle in `src/db/schema.ts`.
  PGlite is used in local dev (`src/db/initDb.ts`, `seed.ts`).
- **Migrations:** `database/migrations/0001–0023` mirrors `supabase/migrations/2025…`.
  The two folders must stay in sync. Note that `0017_rls_legacy_schema_DRAFT.sql`
  has no Supabase twin.
- **Shared logic:** `shared/` (currently `shared/kyc`).
- **Mobile:** Expo app in `mobile/`. The old `tsc-*.txt` files there are error dumps
  from earlier runs.
- **Docs:** `docs/DATABASE_DESIGN.md`, `SYSTEM_SCHEMA.md`, `KYC_FLOW.md`, `AUTHENTICATION.md`.

### Step 0 — Audit first. Don't write code yet.
1. Run `npm install`, `npm run lint` (tsc), `npm test`, and `npm run dev`.
   Write down every error.
2. Do the same for `mobile/` (`npx tsc --noEmit`).
3. Map all routes in the three routers (`src/admin/router.tsx`, `src/branch/routers`,
   `src/portal/routers`) to their page components. For each page, find which API
   endpoint it calls. Then check whether that endpoint exists in `server.ts`, and
   whether the table or columns it uses exist in schema and migrations.
4. Diff `src/db/schema.ts` against the migrations. List every table or column that
   is missing, renamed, or a different type.
5. Write the results to `docs/AUDIT.md`. Use one table per module with these columns:
   | Feature | UI page | API endpoint | DB table | Status (works / broken / missing) | Root cause |
6. Stop. Show me the audit before you fix anything.

### Rules for every fix
- **Fix root causes.** That means wrong column names, missing endpoints, mismatched
  request/response shapes, broken RLS, and bad enum values. Don't hide errors with
  try/catch, `any`, `// @ts-ignore`, or mock data.
- **No fake data in production paths.** Migration 0014 removed demo defaults, so keep
  them out. Seed data goes only in `seed.ts`.
- **Money is exact.** Use `numeric`/`decimal` in the database and integer cents or a
  decimal library in TypeScript. Never use JS floats for balances. Round with one
  documented rule.
- **Every money movement is atomic and ledgered.** Each disbursement, repayment,
  deposit, withdrawal, fee, and penalty runs in one DB transaction. Each one writes:
  - balanced double-entry rows in the financial ledger (`0006_financial_ledger`)
  - an audit row (`0007`)
  - a notification
  Each one must be idempotent. Use an idempotency key or reference number so a
  double-click can't post twice.
- **State machines are enforced on the server, not only in the UI.** That covers
  KYC, loans, savings accounts, and groups. Reject illegal transitions with a clear
  4xx error.
- **Authorization:** every endpoint checks role and branch scope (`src/auth/permissions.ts`).
  A client can only see their own data. Branch staff can only see their own branch.
  Check that RLS policies match.
- **Validation:** validate the same way on client and server. Put shared schemas and
  calculators in `shared/`, like `shared/kyc` already does.
- **Every new migration** goes in both migration folders and gets a matching rollback
  in `database/migrations/rollback/`.
- **After each module:** run `npm run lint`, run `npm test`, and add Vitest tests
  for the business rules (calculations, transitions, permissions). Then click through
  the flow in the running app. Use the browser if you can.
- **Report at the end of each module:** what was broken, what you changed (with file
  paths), what's tested, and anything still not done. Be honest. Don't claim 100%
  if something isn't verified.
- Commit each module separately with a clear message, and only when I ask.

---

## Part B — Module Prompts (paste one at a time, in this order)

### B1. Client Registration & KYC
Make client onboarding work end to end.
- **Registration.** It must work from the branch (staff-assisted) and from the portal
  (self-registration). It needs:
  - email verification (`0013`)
  - duplicate checks on national ID, phone, and email
  - the borrower profile and income fields (`0012`)
  - geography fields (`0019`)
- **KYC.** Upload ID and documents to the private bucket (`0018`). Serve them with
  signed URLs only. Then make the automated ID scan and validation work, using
  `shared/kyc`. The status flow is
  `pending → under_review → verified / rejected / resubmission_required`.
  Apply migration `0023_kyc_workflow_hardening` properly.
- **KYC review queue.** Covers branch `KycQueuePage` and admin `KycVerificationPage`.
  Staff can approve or reject with a reason. Every decision is audited (`0022`), and
  the client is notified.
- **Gating.** An unverified client cannot apply for a loan or open savings. Enforce
  this on the server.
- **Done when:**
  - [ ] A new client can register.
  - [ ] They can upload ID.
  - [ ] Staff can approve the KYC.
  - [ ] The client sees "Verified" in the portal.
  - [ ] Rejecting with a reason lets the client resubmit.
  - [ ] All of these steps are audited.

### B2. Loan Application & Disbursement
- **Loan products** (`ProductsView`/`ProductModal`). Each product has:
  - an interest method: flat or diminishing balance
  - a rate, min/max amount, and min/max term
  - a repayment frequency: weekly, bi-weekly, or monthly
  - fees and a penalty rate
  - whether it is an individual or group product
- **Application.** A client can apply from the portal, or an officer can apply for
  them from the branch. The application checks KYC, product limits, and existing
  active loans. A live amortization preview comes from one shared calculator in
  `shared/`, also used by `CalculatorView`.
- **Workflow.** `draft → submitted → under_review → approved / rejected → disbursed → active → closed / written_off`.
  It includes approval with a reason and an approval-limit check by role.
- **Disbursement.** Uses `LoanDisbursementModal`. It records the method (cash or
  bank/e-wallet) and the reference number. It deducts the fees. In one transaction it:
  - generates and stores the full installment schedule
  - posts the ledger entries
  - prints a receipt (`ReceiptModal`)
- **Done when:** a client can apply, an officer can approve, and a teller can disburse.
  After that, a schedule exists, the ledger balances, and the client sees the active
  loan and schedule in the portal.

### B3. Loan Repayment & Installments
- **Recording a payment.** Use `ProcessPaymentPage`/`PaymentsView`. Payments can be
  full, partial, advance, or overpayment.
- **Allocation order (documented):** penalties → interest → principal. The installment
  status updates to `pending / partial / paid / overdue`.
- **Payment proofs.** The client uploads proof in the portal (`0016`). Staff verify
  it, and only then is the payment posted.
- **Overdue job.** A scheduled job, or a check when the app starts, marks overdue
  installments and applies penalties based on the product. The job must be idempotent.
- **Payoff.** Computes the remaining balance. When the loan is fully paid, it closes
  automatically.
- **Collections view.** Shows overdue loans, days past due, and portfolio-at-risk (PAR).
- **Receipts and ledger.** Every payment produces a receipt and ledger entries.
  Reversals are done with an audited reversal entry. Never delete a payment.
- **Done when:**
  - [ ] Partial, full, and overpayment cases each allocate correctly. Each case has
    a unit test.
  - [ ] Overdue installments get penalized exactly once.
  - [ ] The final payment closes the loan.

### B4. Savings Account Management
- **Products.** Regular, compulsory/group, and time deposit. Each has:
  - an interest rate and accrual method
  - a minimum balance
  - withdrawal limits
- **Accounts.** Open an account (KYC required) and close it. Statuses are
  active, dormant, frozen, and closed.
- **Transactions.** Deposits and withdrawals, including the withdrawal account and
  destination (`0015`).
- **Balance rules.** Withdrawals are blocked if they would break the minimum balance
  or if the account is frozen. The balance comes from the ledger. If you keep a
  cached balance column, it must be consistent with the ledger.
- **Interest.** An interest posting job runs and is idempotent per period.
- **Statements.** Show running balances (`SavingsTransactionsPage`) and can be
  exported or printed.
- **Done when:** deposit, withdrawal, and interest posting all work and reconcile
  with the ledger. A withdrawal over the limit is rejected by the server.

### B5. Group Lending Support & Solidarity Mechanism
- **Groups.** Create a group. Add and remove members (KYC-verified only). Assign the
  roles leader, secretary, and treasurer. Set a meeting schedule and branch/officer
  assignment.
- **Group loans.** Either one loan per member under the group, or one group loan.
  Choose one approach, document it, and apply it consistently. Group approval
  requires member consent or guarantor records.
- **Solidarity mechanism.** Members are jointly liable:
  - When a member is overdue, the group and its leader are notified.
  - The group's compulsory savings or solidarity fund can cover the shortfall. This
    is posted as a ledger transfer that the member owes back.
  - The group can't take new loans while any member is in arrears beyond a
    configured threshold.
- **Group views.** Meeting and attendance records, plus a group repayment collection
  screen where you enter several members' payments at once (batch posting in one
  transaction).
- **Fix the known crash** in `GroupDetailPage` and check that it doesn't regress.
- **Done when:**
  - [ ] A group can be formed and members can borrow.
  - [ ] When one member defaults, the solidarity fund covers them.
  - [ ] That cover is ledgered and tracked as owed.
  - [ ] The group is blocked from new loans until the arrears are cleared.

### B6. Client Self-Service Portal (Web + Mobile)
- **Portal (`src/portal`):**
  - login
  - dashboard: loans, next due date, savings balances, KYC status
  - loan application and status tracking
  - repayment schedule
  - uploading payment proof
  - savings transactions and statements
  - group membership info
  - notifications
  - profile and password change, with the strength indicator
- **Mobile (`mobile/`):** fix all TypeScript errors so `npx tsc --noEmit` is clean.
  Then make it hit the **same** API endpoints as the web portal. No duplicate logic:
  use the shared types and calculators. Delete the stale `tsc-*.txt` files.
- **Consistent client-facing UX:** every screen has loading, empty, and error states,
  works on mobile widths, and formats currency and dates properly.
- **Security:** a client can never read another client's data. Test this by trying
  someone else's IDs, both through the API and through Supabase directly with RLS.
- **Done when:** a client logged in on web and on mobile sees the same correct data,
  and can do the actions above with no console or network errors.

---

## Part C — Final Integration Prompt (paste last)

Run one full end-to-end scenario on a fresh database (migrations + `seed.ts` only):

1. Register client A and client B. Verify their KYC.
2. Form a group with A, B, and a third client.
3. Open savings accounts and make deposits.
4. Each member applies for a loan. Approve and disburse.
5. Client A pays on time. Client B pays partially, then goes overdue.
6. The penalty applies, and the solidarity fund covers B.
7. B repays the group.
8. A fully repays, and A's loan closes.

After the scenario:
- Confirm the trial balance of the ledger is zero.
- Confirm that the admin reports, the branch reports, and the client portal all show
  the same numbers.
- Make sure `npm run lint`, `npm test`, `npm run build`, and the mobile tsc all pass.

Update `docs/AUDIT.md` so every row reads "works", or list exactly what remains and why.
