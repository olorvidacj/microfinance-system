# Prompt: Close the Remaining AUDIT.md Items (#8, #6, #3, #2)

> How to use: paste everything below the line into a **new** Claude Code chat.
> It does one item at a time and stops after each so you can review and commit.

---

You are closing the last open items in the "What remains" list of `docs/AUDIT.md`. The
system works and the security items are done. Don't break anything. Follow the rules in
`docs/FIX_PROMPT.md` Part A:
- Fix root causes, with exact money and shared rules in `shared/`.
- Every migration goes in both `database/migrations` and `supabase/migrations`, gets a
  rollback, and is added to `APPLY_ORDER.txt`.

## Step 0 — Before touching code
1. Confirm we're on `main`, up to date with `origin/main`, with a clean working tree.
   If not, **stop and tell me.**
2. Confirm that `docs/AUDIT.md` no longer says "apply migration 0031". If it still
   does, stop and remind me to apply 0031 to production first.
3. Create a branch `fix/audit-remaining-items`.
4. Run `npm run lint` and `npm test`, and note the baseline.

Do the items **in this order: #8 → #6 → #3 → #2**. After each item:
- run `npm run lint` and `npm test`, and add tests for the new behavior
- update that item's row in `docs/AUDIT.md`
- commit it as its own commit
- **stop and report to me.** Don't start the next item until I say "next".

---

## Item #8 — Audit `/api/gemini/*`
There are three endpoints in `server.ts`, around lines 2520–2700:
`POST /api/gemini/underwrite`, `/api/gemini/reminder-draft`, and
`/api/gemini/restructure-advice`.

Check and report each of these:
1. **Who can call it.** Check the permission and branch scope. Can staff ask about a
   member from another branch?
2. **What personal data goes to Google.** List the data sent to Gemini: names, IDs,
   income, phone numbers. Send only what's needed. No ID numbers or photos.
3. **API key handling.** Make sure the key stays on the server only (not
   `VITE_*`/`EXPO_PUBLIC_*`). Without a key, the endpoint should return a clear 503,
   not crash.
4. **Output used as fact.** AI output must be advice only. It must never change a loan,
   a status, or money by itself. A human decision must stay in the loop.
5. **Abuse and cost.** Add a request limit (reuse `src/routes/requestLimit.ts`), a
   timeout, and an input size limit.
6. **Callers and dead code.** Find which screens call these endpoints. Remove any
   endpoint nothing calls, but **ask me first.**
7. **Audit log.** Make sure each call is logged: who asked, about which member. Don't
   log the full AI text.

Fix what's wrong, add tests (mock Gemini, no real calls), and record the findings in
AUDIT.md section 3.4.

---

## Item #6 — Convert the 16 float money columns to `numeric`
The columns are listed in AUDIT.md section 4.2: `borrowers` (6), `branches` (2),
`interest_credit_logs`, `member_follow_up_logs`, `membership_applications`, and
`solidarity_groups` (3).

1. **Choose a type for each column.** Money gets `numeric(14,2)`. Rates and
   percentages get `numeric(7,4)` (or what fits). Show me the list before writing the
   migration.
2. **Check the data first.** Before converting, query the local database for values
   with more than 2 decimals, NaN, or Infinity. Report what you find, and round only
   with one documented rule.
3. **Write the migration** `0032_…` / `20250101043000_…` using
   `ALTER COLUMN … TYPE numeric(…) USING round(col::numeric, 2)`, in one transaction.
   Write its rollback too.
4. **Update the code.** Update the Drizzle schema in `src/db/schema.ts`, then every
   read and write of these columns. No `Number(...)` for money: use the cents helpers
   already in the code. Note that Postgres returns `numeric` as a string.
5. **Verify.** Run `npm run db:verify`, the full tests, and a fresh database built from
   migrations.

**Production:** write the migration but **do not apply it.** Give me the exact
commands and remind me to back up first.

---

## Item #3 — Branch Performance charts on the portfolio module
`src/branch/pages/PerformancePage.tsx` and its API currently sum payments as JavaScript
numbers and group them by UTC week.

- **Use the shared module.** Compute the figures in `src/reports/portfolio.ts`, the
  same module the dashboards use: exact cents, posted payments only, and reversed
  payments excluded.
- **Manila time.** Group by Manila week and month (Asia/Manila), the same as the
  dashboard's "today".
- **Branch scope.** Each branch sees only its own data. Admins with `view_all_records`
  can see all branches.
- **Same numbers everywhere.** Add a test that the Performance totals match the branch
  dashboard and reports for the same period.
- **Empty and error states.** Show empty and error states, and no invented targets or
  sample data.

---

## Item #2 — Move superseded migrations to `superseded/`
`APPLY_ORDER.txt` skips these migrations: 0003–0010, 0017, and 0019–0022. But
`supabase db reset` would still run them.

1. **List the files.** List the exact files in both folders (`database/migrations`
   and `supabase/migrations`) and their skip reasons from `APPLY_ORDER.txt`.
   **Show me the list and stop.**
2. **After I approve,** move them with `git mv`, not delete, into
   `database/migrations/superseded/` and `supabase/migrations/superseded/`. Keep their
   rollbacks where they make sense.
3. **Update the references.** Update `APPLY_ORDER.txt`, `scripts/db/migrate.mts`,
   `scripts/db/verify-migrations.mjs`, and any docs that point at the old paths.
4. **Verify.** Run `npm run db:migrate` on a fresh local database, then
   `npm run db:verify` and the full tests. If the Supabase CLI is installed, check
   that `supabase db reset` builds the same database locally. If it isn't installed,
   say so.
5. **Leave production alone.** Production already recorded these migrations as
   applied or skipped. Confirm `npm run db:migrate -- --status` against production
   would still show nothing pending (read-only check).

---

## Final report
- Summarize what changed per item, with file paths.
- List the migrations I still need to apply to production, with the commands.
- Confirm that "What remains" in `docs/AUDIT.md` is now empty, or list exactly what's
  left and why.
- Be honest about anything you didn't verify.
