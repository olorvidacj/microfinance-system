# Prompt: Fix the Security Items in AUDIT.md (#1, #5, #4, #7)

> How to use: paste everything below the line into Claude Code.
> It does one item at a time and stops after each so you can review and commit.

---

You are fixing four open security items from the "What remains" list in `docs/AUDIT.md`.
The rest of the system already works. B1–B6 are done, there are 396 tests passing, and
`tsc` is clean. Don't break anything. Follow the rules in `docs/FIX_PROMPT.md` Part A:
- Fix root causes. No `any`, no `@ts-ignore`, no swallowed errors.
- Every new migration goes in both `database/migrations` and `supabase/migrations`,
  gets a rollback in `database/migrations/rollback/`, and is added to
  `database/migrations/APPLY_ORDER.txt`.
- Shared rules live in `shared/`.

## Step 0 — Before touching code
1. Run `git status`. If there are uncommitted changes that aren't part of this task,
   **stop and ask me to commit them first.** (The KYC guided-verification work may
   still be uncommitted. It touches `src/routes/branchRoutes.ts`, which item #4 also edits.)
2. Create a branch `fix/audit-security-items` from where I am.
3. Run `npm run lint` and `npm test`, and note the baseline.

Do the items **in this order: #1 → #5 → #4 → #7**. After each item:
- run `npm run lint` and `npm test`
- add tests for the new behavior
- update that item's row in `docs/AUDIT.md` (status, what changed, file paths)
- **stop and report to me.** Don't start the next item until I say "next".

---

## Item #1 — The public `documents` storage bucket
**Problem:** in Supabase, the `documents` bucket has `public = true`. Listing it is
refused, but anyone who knows a file's exact path can download that file.

**Investigate first and report what you find:**
- `DOCUMENT_BUCKET` in `src/db/documentStorage.ts` is `'kyc-documents'`. That bucket is
  already private, and branch documents are served through signed links in
  `src/routes/branchRoutes.ts` (`GET /documents/:id/file`) and `src/client/documents.ts`.
  Confirm whether **any** code still writes to or reads from the `documents` bucket.
- Search all `fileUrl` / path columns (for example `documents.file_url`, payment proofs,
  avatars) for values that point at the `documents` bucket or are full public URLs
  (`.../storage/v1/object/public/...`).
- Use a read-only check to see whether the `documents` bucket holds any objects.
  Migration 0023 says it held none at the time.

**Fix:**
- Write the next migration (`0031_…` / `20250101042000_…`) with a rollback. It sets
  `documents` to `public = false` and drops any public read policy on it.
  - If the bucket is empty and unused, say so, and give me the choice between deleting
    it and keeping it private.
- If any stored rows hold public URLs, convert them to storage paths in the same
  migration. Make sure every place that shows those files gets a short-lived signed
  link from the server.
- Make sure no code calls `getPublicUrl` and no client gets direct bucket access.

**Production:** write the migration but **do not apply it to the live Supabase project.**
Tell me the exact command, and remind me to back up first (like
`database/backups/full-20261021-223445`). I'll run it or tell you to.

**Done when:**
- [ ] No bucket is public.
- [ ] Branch staff and members can still open their documents through signed links.
      Test it.
- [ ] Opening a raw `/storage/v1/object/public/documents/...` URL fails.

---

## Item #5 — `/api/storage` serves files without a login
**Problem:** `server.ts` has `app.use('/api/storage', …)` around line 134. It's registered
before the auth plumbing, so anyone can fetch any file under `uploads/` (except `kyc/`).
`saveDocument` in `src/db/documentStorage.ts` falls back to the local disk when Supabase
storage fails. It then returns `/api/storage/...` as the "signedUrl", with a name built
from a timestamp and `Math.random` (about 31 bits).

**Fix:**
- **Signed links.** Serve local fallback files only through signed, expiring links that
  match the Supabase behavior. Use an HMAC token over `path + expiry`, signed with a
  server secret from env (add it to `.env.example`). Use a short TTL, like the
  10–30 min used elsewhere.
- **Same route for both backends.** The routes that hand out file links
  (`branchRoutes` `/documents/:id/file`, `src/client/documents.ts`, payment proofs)
  must give a signed local link when the file lives in the fallback store. They must
  still check branch scope and member ownership first, exactly as they do for Supabase.
- **Unguessable names.** Use `crypto.randomUUID()` (or `randomBytes`) instead of
  `Math.random`.
- **Path traversal.** Resolve the path with `path.resolve` and refuse anything outside
  the `uploads/` directory. The current regex normalize isn't enough. Keep refusing `kyc/`.
- **Production safety.** In production (`NODE_ENV=production`), a Supabase upload
  failure should **fail the upload with a clear error.** Don't silently write to local
  disk unless an explicit env flag allows the fallback.
- **Old URLs.** Keep working any existing DB rows that store a bare `/api/storage/...`
  URL by serving them through the new signed flow. Don't just break them.

**Done when:**
- [ ] A request with no token, a wrong token, an expired token, or a `../` path gets
      401/403/404.
- [ ] A valid signed link works.
- [ ] Another member or branch can't get a link to the file.
- [ ] Tests cover each of these cases.

---

## Item #4 — Staff phone/email edits skip validation and the duplicate check
**Problem:** `branchRouter.put('/clients/:id')` in `src/routes/branchRoutes.ts` (around
line 603) writes `phone` and `email` straight from the request body with `String(...)`.
Self-service (`updateOwnProfile` in `src/client/profile.ts`) runs the shared validation
(`validateProfileUpdate`, `phoneKey` in `shared/kyc-core`) and refuses a phone number that
another account already uses. The phone number is a **sign-in identifier**, so a
duplicate or invalid one is a real problem.

**Fix:**
- **One shared rule.** Run the staff edit through the same shared validation and
  normalization as self-service, for phone, email, and the other fields. Reuse the
  existing helpers: `shared/kyc-core` validation and `normalizePhilippinePhone` in
  `src/auth/supabaseAuth.ts`. Don't write a second copy. If a helper has to move into
  `shared/`, move it.
- **Uniqueness.** Check phone and email against other `users` **and** other `borrowers`,
  using the normalized key, inside one transaction. Return 409 with a field error.
- **Linked login.** If the member has a login, update `users.phone`/`users.email` in
  the same transaction so the two can't drift apart. Also update the Supabase auth
  record if sign-in uses it, the same way password reset changes both stores.
- **Smaller bugs in the same handler:**
  - return 404 when the client isn't in the staff member's branch, even when no
    identity fields are sent (right now it returns `success: true` after updating
    0 rows)
  - store `monthlyIncome`/`monthlyExpenses` as exact decimals, not `Number(...)`
  - audit the old and new phone and email values
- **Front end.** Make the branch client edit form show the server's field errors.

**Done when:**
- [ ] Staff can't save an invalid phone number or one that's already in use.
- [ ] The member can still sign in with the new number after a valid change.
- [ ] Tests cover each of these cases.

---

## Item #7 — Delete the unreachable legacy code and `public/supabase_schema.sql`
**Problem:** `public/supabase_schema.sql` is served to anyone at `/supabase_schema.sql`
and exposes the database structure. The old staff shell (`MainApp`,
`src/context/LoanContext.tsx`, `src/components/*View.tsx`, `SupabaseModal.tsx`, ...) is no
longer reachable.

**Fix:**
1. **Prove it's unreachable.** Trace imports from the real entry points: `src/main.tsx`,
   `src/App.tsx`, the admin/branch/portal routers, and `server.ts`. Make a list of every
   file nothing reaches.
   - Some components in `src/components/` **are** still used. For example,
     `src/components/kyc/*` and `KycStatusBadge.tsx` may be. Don't delete those.
   - Check `scripts/` and `mobile/` too.
2. **Show me the full list of files to delete, and stop.** Don't delete anything until
   I approve.
3. **After I approve:**
   - delete the files and `public/supabase_schema.sql`
   - remove the references in `docs/SYSTEM_SCHEMA.md`
   - leave the root `supabase_schema.sql` (used by `scripts/run-full-schema.mjs`), but
     tell me whether that script is still needed
   - rebuild so `dist/` no longer contains the schema file
4. Run `npm run lint`, `npm test`, `npm run build`, and `npx tsc --noEmit` in `mobile/`.
   Then load the portal, branch app, and admin console to confirm nothing broke.

**Done when:**
- [ ] `GET /supabase_schema.sql` returns 404 on the dev server and on the built app.
- [ ] All checks pass.
- [ ] All three apps load with no console errors.

---

## Final report
After all four items:
- Summarize what changed per item, with file paths.
- List any migration I still need to apply to production, with the command.
- Confirm that `docs/AUDIT.md` "What remains" now only lists items 2, 3, 6, and 8.
- Be honest about anything you didn't verify.
