# KYC flow

## Guided verification (current)

Members verify their identity in a guided flow, on the web portal (`/portal/kyc`,
`src/portal/kyc/`) and in the mobile app (`mobile/src/screens/client/KycFormScreen.tsx`).
Both use the same steps, payload and checks from `shared/client/kycSteps.ts` and
`shared/client/kycForm.ts`. The server (`src/kyc/service.ts`) decides what is
accepted; the screens only explain its rules early.

### What the member does

A welcome screen says what to prepare and how the data is protected. Then six
steps, with "Step N of 6":

1. **Personal information**: name, birth details, contact details, PSGC address.
2. **Government ID**: front, plus the back for IDs that have one (required by the
   server for those types). Guided camera or file upload. The server checks each
   photo's quality before keeping it.
3. **Check your ID details**: what was read from the ID, next to each field, for
   the member to confirm or correct. Differences are shown to the member and to
   staff.
4. **Selfie**: explicit consent to the biometric comparison first (RA 10173), then
   the selfie.
5. **Work and documents**: income details and the supporting documents the branch
   requires.
6. **Review and submit**: a summary with links back to each step, then the
   declarations.

Progress is saved automatically (a few seconds after typing stops, on every step
change, and when the tab is hidden). A member who comes back resumes at the first
unfinished step. The dashboard card shows the status, the steps still to do, staff
feedback and the next action. The loan page explains the KYC requirement.

| Status | Shown as | Member can |
|---|---|---|
| `NOT_STARTED` | Not started | start |
| `IN_PROGRESS` | In progress | continue |
| `SUBMITTED` | Pending review | wait |
| `UNDER_REVIEW` | Under review | wait |
| `CORRECTION_REQUIRED` | Additional information required | change only the requested parts |
| `APPROVED` | Approved | apply for loans and savings |
| `REJECTED` | Rejected | resubmit only if staff allowed it |
| `SUSPENDED` | Suspended | contact the branch |

### What is automated, and what is not

- **ID reading** (Gemini, `GEMINI_API_KEY`) only fills in details for the member to
  check. It never verifies an ID. Without a key the member types the details.
- **Photo quality** (blur, light, glare, size, real file type) is checked by the
  server on every upload. Passing it means the photo is usable, not that the ID is
  genuine.
- **Face comparison** uses AWS Rekognition CompareFaces when
  `FACE_VERIFICATION_PROVIDER=aws-rekognition` is configured. Without it the result
  is "unavailable" and a branch officer compares the photos. Nothing estimates a
  match without a verification service.
- **Approval needs a person.** The server refuses to approve
  (`409 FACE_REVIEW_REQUIRED`) unless the face service reported a match or the
  reviewer confirms comparing the selfie with the ID photo themselves.
- **No liveness check.** A photo of a photo is not detected automatically, and the
  review panel tells staff so. Adding one needs a liveness provider, for example
  AWS Rekognition Face Liveness with its mobile and web components.

### Staff review

The branch queue (`/staff/app/kyc`) and the head-office queue filter by status,
name, member number, reference and submission date. The review panel shows:

- the ID photo and the selfie side by side;
- the declared details next to what was read from the ID, with differences
  highlighted;
- the face-check result in plain words, and the member's biometric consent.

Decisions:

- **Request changes** names the parts the member must change (`KYC_SECTIONS`). The
  server refuses changes to other parts (`409 NOT_REQUESTED`). A new ID photo
  reopens the selfie check.
- **Reject** either allows resubmission, or is final and tells the member to
  contact the branch.
- **Approve** requires the face confirmation described above.

Every decision needs a reason, notifies the member and is written to
`kyc_audit_log`.

### Security

- Members can only reach their own application. Status changes go through the
  server's state machine and the database guard (`kyc_transition_allowed`,
  migration 0023). A member cannot approve or change their own status.
- KYC files live in the private `kyc-documents` bucket. Only the server reads them,
  with the service-role key, and hands out 5-minute signed links. KYC tables have
  RLS on with no member policies and no `anon`/`authenticated` grants (0023). No
  provider secret or service-role key reaches the browser or the app.
- Limits per member are counted in the audit log, so they hold across restarts:
  - 40 uploads an hour;
  - 10 ID readings an hour;
  - 10 face checks an hour;
  - 5 submissions a day.

  An in-memory cap of 60 requests per 10 minutes also covers the upload, check
  and submit endpoints.
- Consent to the biometric comparison is recorded as `CONSENT_GIVEN` or
  `CONSENT_WITHDRAWN` in the append-only audit log. Audit entries record actions,
  outcomes and file hashes; they hold no ID numbers, passwords or tokens.
  Unexpected server errors are logged whole (`src/routes/httpErrors.ts`), so
  database error text can appear in the server log.

### Retention

KYC records and files are kept, never deleted automatically. The Anti-Money
Laundering Act (RA 9160 as amended) requires identification records to be kept
for at least five years after an account is closed. Confirm the period with
compliance before adding any deletion. Replaced files stay on record as
superseded, and every submitted version is kept as a snapshot.

### Setup

1. Set `GEMINI_API_KEY` for ID reading (optional).
2. For automated face comparison, create an AWS IAM user allowed
   `rekognition:CompareFaces` only. Set `FACE_VERIFICATION_PROVIDER=aws-rekognition`,
   `AWS_REGION`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. Optionally set
   `FACE_MATCH_MIN_SIMILARITY`, which defaults to 95.
3. No new migration is needed. This flow uses the tables from 0023 onwards.
4. Mobile: `expo-camera` is included in Expo Go. For custom builds, its plugin
   in `mobile/app.json` sets the camera-permission message.

### Endpoints

Member (`/api/client`, the signed-in member's own application):

| Endpoint | Purpose |
|---|---|
| `GET /kyc-status` | Status, saved application, requirements, ID reading, face result, differences |
| `POST /kyc/save-draft` | Save progress (only the requested parts while changes are requested) |
| `POST /kyc/documents/upload` | One document or ID side |
| `POST /kyc/process-id` | Store any new ID photo, then read the stored ID |
| `POST /kyc/match-face` | Store a new selfie (optional), then compare it with the stored ID photo |
| `POST /kyc/submit` | Submit; refused with the list of issues and the step to fix |

Branch staff (`/api/branch`, own branch):

| Endpoint | Purpose |
|---|---|
| `GET /kyc-queue` | Query: `status`, `search`, `submittedFrom`, `submittedTo` |
| `GET /kyc/:id` | The review dossier |
| `POST /kyc/:id/claim` and `/release` | Take or return a review |
| `POST /kyc/:id/review` | `{ decision, reason, sections, allowResubmission, faceReviewed }`, with an `Idempotency-Key` header |

Head office (`/api/admin`) has the same calls:

- `GET /kyc-requests`
- `GET /kyc/:borrowerId`
- `POST /kyc/:borrowerId/claim`, `/release` and `/decision`

---

The sections below are earlier notes from the migration work (0019–0022). They are
kept for history.

## The state of this repository's schema

`src/db/initDb.ts` and `database/migrations/` describe the same database and
they have drifted apart. This is not a recent problem and it is not caused by
the KYC work, but the KYC work cannot be reasoned about without knowing which
one is real. So: **`initDb.ts` is the source of truth.** Migrations are applied
by hand, are not tracked anywhere, and are verified by
`npm run db:verify-migrations` rather than by a runner.

### Two incompatible data models

| | Model A — live | Model B — dead prototype |
|---|---|---|
| Identity | `borrowers`, `staff`, `branches`, `users` | `profiles`, `clients` |
| Loans | `loans.borrower_id` | `loans.client_id` |
| Savings | `savings_accounts.member_id` | `savings_accounts.client_id` |
| KYC | `kyc_submissions` (JSONB) | `client_kyc.verification_status` |
| Defined in | `initDb.ts`, migrations 0011–0018 | migrations 0001–0010 |
| Written to by code | yes | no |

Migrations 0001–0010 are a Supabase prototype. No code path writes to the tables
they create, so they describe a database that does not exist and never did.
Migration 0011 is itself hybrid: Model-A tables, but its storage policies check
staff membership through Model-B's `profiles` table.

Run `npm run db:compare-schemas` for the current, machine-generated comparison.

### Tables no migration creates

`borrowers`, `branches`, `staff`, `users`, `payments`, `documents`,
`solidarity_groups`, `membership_applications`, `id_sequences`,
`savings_withdrawal_requests`, `interest_credit_logs`,
`member_update_requests`, `member_follow_up_logs`, `branch_notifications`.

Migration 0012 references `borrowers` and fails on a database that has never
started the app. This is why `npm run db:verify-migrations` bootstraps from
`initDb.ts` rather than assuming a migration-only database.

### Known divergences left in place

- Six tables have two different column sets: `loans`, `loan_products`,
  `savings_accounts`, `savings_transactions`, `financial_transactions`,
  `audit_logs`. In every case the Model-A shape is the live one.
- `kyc_status` existed as a lowercase enum (`pending`, `verified`, `rejected`,
  `expired`) used only by the dead `client_kyc`. Migration 0019 renames it to
  `legacy_kyc_status` so the name can mean the eight states in the
  specification.
- `borrowers.kyc_status` is unconstrained `TEXT` and has held at least three
  vocabularies. Migration 0021 normalises it to the canonical eight and adds a
  safe fallback: an unrecognised value becomes `NOT_STARTED`, never `APPROVED`.
- `borrowers.member_status` is a **separate axis** and must never be remapped
  alongside `kyc_status`. A member can be active with an unverified KYC.

## The eight statuses

`NOT_STARTED`, `IN_PROGRESS`, `SUBMITTED`, `UNDER_REVIEW`,
`CORRECTION_REQUIRED`, `APPROVED`, `REJECTED`, `SUSPENDED`.

Only `APPROVED` unlocks KYC-dependent services such as applying for a loan.

## Database-enforced rules

0022 makes the parts of the flow that a bypass would target impossible to reach by
writing directly to the tables, so a bug in a route is not enough to get an
approval.

**Status is a directed graph, not a free field.** `SUBMITTED → APPROVED` is
rejected. A reviewer has to claim the file (`UNDER_REVIEW`) before deciding it, so
an approval always corresponds to a human picking it up.

**Deciding requires a role.** Moving to `APPROVED`, `REJECTED` or `SUSPENDED`
requires `app_may_decide_kyc()` to be true, and `UNDER_REVIEW` requires staff. Both
read `app.actor_role` from the transaction, and an unset variable means
*unprivileged*, never *allowed*. The same variables back the RLS policies, so
there is one authorisation decision rather than two that can disagree.

**A submitted record is frozen.** Once `submitted_at` is set, the `snapshot` that
staff actually reviewed cannot be rewritten. A correction produces a new
application version instead.

**The audit log is append-only.** `UPDATE` and `DELETE` on `kyc_audit_logs` raise
`insufficient_privilege`. The application role needs no extra grant because the
trigger refuses regardless of who is asking.

**New applications cannot arrive pre-approved.** An `INSERT` with a resolved
status is rejected. The single exception is 0021's backfill, which sets
`app.migration = '0021'` — a migration of historical records is not a request. The
flag exists so 0021 stays re-runnable on a database where 0022 is already
installed, which matters because there is no migration runner.

**`borrowers.kyc_status` follows the application.** An `AFTER` trigger mirrors
the application status, so the loan gate and the KYC screen cannot disagree about
whether someone is verified. `member_status` is never touched.

### RLS is installed but not enforced

0022 creates the helper functions and policies, and turns RLS **on** — but not
`FORCE`d. The application connects as the table owner, and an owner silently
bypasses RLS unless it is forced, so as written the policies are dormant.

This is deliberate, and it is the last step rather than the first. Before forcing
RLS, the backend must set `app.borrower_id`, `app.actor_role` and
`app.staff_branch` per transaction from the authenticated request, and the
policies must be extended beyond `SELECT` to cover writes. Forcing RLS before
that would break every write path in the app. See Outstanding work.

## Migrations added for this work

| File | Purpose |
|---|---|
| `0019_kyc_core_and_geography.sql` | `kyc_status` enum, PSGC reference tables, KYC configuration, ID and document catalogues, consent templates |
| `0020_kyc_data.sql` | Normalised KYC data model; retires legacy `kyc_documents` to `kyc_documents_legacy` |
| `0021_kyc_backfill_and_status_remap.sql` | Legacy JSONB backfill and status normalisation |
| `0022_kyc_rls_and_audit.sql` | Directed status graph, audit immutability, submitted-snapshot freeze, RLS policies |

Apply them in order. All are safe to run more than once.

## Verification

```
npm test                        # unit tests: KYC status rules, PSGC snapshot integrity
npm run db:verify-migrations    # the live lineage: initDb + 0011-0022
npm run db:verify-all-migrations # the whole directory, including the dead prototype
npm run db:compare-schemas      # the Model A / Model B comparison
```

`verify-migrations` creates a scratch database on the connection in `.env`,
applies the chain, and then asserts four things:

1. **Schema invariants** — the tables, enums, constraints, triggers and seeds
   the flow depends on actually exist.
2. **Behaviour** — invalid data is *rejected*. Checking that a constraint exists
   proves nothing; a trigger that silently does nothing is the failure mode that
   would let a hand-crafted request attach a Manila barangay to a Cebu city.
3. **Re-runnability** — migrations are applied by hand with no tracking table,
   so running one twice has to be safe.
4. **The backfill** — planted legacy rows are migrated, and nothing is invented.

The scratch database is dropped afterwards unless `--keep` is passed. It never
touches the application database. CI runs it against a `postgres:16` service
container, in a job separate from the build.

`npm run psgc:verify` is deliberately *not* in CI. It re-fetches the PSA mirror
over the network, and unauthenticated calls to `api.github.com` rate-limit at 60
per hour; a network call belongs in the snapshot refresh, not in a merge gate.
The offline half — the committed file's internal consistency and its agreement
with its own recorded counts — is asserted by `scripts/psgc/psgcSnapshot.test.ts`.

## The normalised model is not wired up yet

Worth being blunt about, because it is the largest gap in this work: the tables in
0019–0022 have **no callers**. A repository-wide search for `kyc_applications`,
`kyc_personal`, `kyc_addresses`, `psgc_` and the rest returns nothing outside the
migrations themselves. All live KYC still runs on four legacy tables —
`kyc_submissions` (JSONB), `kyc_documents`, `kyc_audit_log`,
`kyc_required_documents`.

So the transition graph, the snapshot freeze, the append-only audit log and the
RLS policies in 0022 enforce nothing today. They are a correct foundation, not a
working feature. Turning on `FORCE ROW LEVEL SECURITY` before the routes use
these tables would enforce policies on tables nobody reads, while breaking every
write path that does exist.

Converting the routes is the remaining work, and it is the part that turns this
from scaffolding into an enforced flow.

## Application-layer fixes already made

These were live defects, found while wiring the above, and are fixed:

- **The loan gate allowed `PENDING`.** It blocked `NOT_STARTED`, `REJECTED` and
  `CORRECTION_REQUIRED` and allowed everything else, so a KYC submission no human
  had looked at unlocked a real loan application. It is now an allowlist —
  `src/utils/kycStatus.ts` — where only `APPROVED` (and the pre-0019 spelling
  `VERIFIED`) passes, and an unrecognised status is refused rather than assumed
  benign. Regression-tested.
- **IDOR on `PATCH /api/client/notifications/:id/read`.** It updated by id with
  no ownership predicate, so any authenticated client could mark any
  notification in any branch as read. Now scoped to the caller's own
  borrower-targeted rows, and 404s rather than reporting a false success.
- **The client notification feed was unscoped.** It filtered on `relatedId` alone.
  `relatedId` is only unique within `relatedType`, so loan ids and borrower ids
  are different id spaces that can collide. Now filtered on both.
- **`POST /client/apply-loan` and both upload routes** fell back to
  `req.authUser.id` — a `users` row id used in a `borrowers` lookup. An unlinked
  account would match no borrower, which reads as "no KYC on file" rather than
  "not your account". Removed.
- **`GET /kyc-queue` read every client's KYC payload** across all branches and
  filtered the response afterwards, so every client's `personalInfo`, address and
  employment were loaded into the process. Now restricted to the borrowers
  already scoped to the branch.
- **`POST /kyc/submit` reported success without writing anything** when the
  database was unreachable, and wrote the submission, borrower status, document
  rows and audit entry as four independent operations — a failure partway left a
  borrower marked `PENDING` with no audit trail. Now a single transaction, and an
  honest 503.

## What the backfill deliberately does not do

The governing rule in 0021 is that nothing is invented. Where legacy data cannot
be represented faithfully, the gap is recorded and a correction is raised
instead of filling it in with a plausible guess.

- **Addresses are not backfilled.** The legacy address was free text with no
  PSGC codes. Codes could be derived by name lookup, but barangay names are not
  unique across the country and a silent mismatch attaches a client's address to
  the wrong municipality — which means a reviewer approves a loan against the
  wrong evidence. The address section is left outstanding for the client to
  re-enter with the guided form.
- **Personal records migrate only when complete.** A row missing
  `placeOfBirth` or `nationality` is skipped rather than given a placeholder, and
  a correction is raised. An invented nationality in front of a reviewer
  deciding on a loan is worse than an empty record.
- **Documents keep a `legacy_reference`.** Legacy uploads only ever had a signed
  URL, which has expired, so there is no durable object. Those rows are marked
  for re-upload. The unmapped `document_type` values are reported in a `NOTICE`
  at the end of the migration rather than guessed at.
- **Legacy document types are mapped by best fit, and one mapping is a guess.**
  `barangay_id` and `valid_id` were legacy submissions to a barangay-verification
  form. Neither is a proof of address. They are currently migrated as
  `PROOF_OF_ADDRESS` so the reference is not lost, but this should be reviewed —
  a more honest end state is a `GOVERNMENT_ID` document type, or leaving them
  unmapped with a re-upload correction. Do not read an existing
  `PROOF_OF_ADDRESS` row as a real address document without checking
  `legacy_reference`.
- **An unsupported approval never survives.** A borrower whose `kyc_status` said
  `VERIFIED` with no submission behind it, or with a submission that says
  `PENDING`, is moved to `CORRECTION_REQUIRED`. Resolving a contradiction in
  favour of approval would invent an approval.

Legacy rows are never deleted by these migrations. `kyc_documents_legacy` and
`kyc_submissions` remain as the record of what was there.

## Outstanding work

- **Convert the routes to the normalised model.** This is the prerequisite for
  everything else in this list; until it happens, 0019–0022 are inert.
- **RLS enforcement.** Set `app.borrower_id` / `app.actor_role` / `app.staff_branch`
  per transaction in the pooled client, extend the policies to `INSERT`/`UPDATE`/
  `DELETE` (currently `SELECT` only), then `FORCE ROW LEVEL SECURITY` — all after
  the routes use the normalised tables.
- `src/db/schema.ts` — Drizzle definitions for the new tables.
- The status decision guard requires `app.actor_role`, so every existing
  approve/reject route must set it once RLS is enforced.
- Two `authenticate` implementations disagree: `server.ts:109` and
  `clientMobileRoutes.ts:104`. On the HMAC path both trust the JWT's role claims
  with no `isActive` re-check and no role re-read, so a demoted or deactivated
  staff member keeps their role until the token expires. One implementation, read
  from the database.
- PSGC importer, with a staff-facing re-import path.
- Document storage: magic-byte validation and durable paths. The legacy code
  validated by file extension only, which is spoofable.
- `ADMIN_READ_ANY` is a 10-permission OR-list, so any one of them grants full
  cross-branch visibility of every client's KYC metadata and documents.
- `branch_notifications.is_read` is one column shared by every recipient, so one
  staff member marking a broadcast read marks it read for the branch.
- Selfies stay `MANUAL_REVIEW`. There is no liveness provider, and reporting
  `PASSED` without one would be a false claim.
- Email OTP is the only verification channel in use. `require_mobile_verification`
  defaults to `false` because no SMS provider is configured; a completeness
  check that demanded an unperformed verification would be a lie.
- Route-level tests. `npm test` covers the KYC status rules and the PSGC
  snapshot; the ownership fixes above are correct by construction but nothing
  exercises them over HTTP yet. Supertest against a scratch database, reusing the
  connection handling in `scripts/db/verify-migrations.mjs`.
