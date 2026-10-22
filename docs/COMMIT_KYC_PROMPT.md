# Prompt: Commit the KYC Guided-Verification Work

> How to use: paste everything below the line into Claude Code.
> It checks the work, shows you a commit plan, and waits for your OK before committing.

---

Commit my uncommitted KYC guided-verification work safely. Don't change features. This
is a checking and committing task. Only fix something if a check fails, and tell me
about it when you do.

## Step 1 — Check where we are
- Confirm the current branch is `feat/kyc-guided-verification`. **Never commit on `main`.**
  If we're on `main`, stop and ask me.
- Run `git status` and `git diff --stat`. There should be about 57 changed or new files,
  including:
  - new: `src/kyc/faceVerification.ts`, `shared/kyc-core/liveFrame.ts`,
    `shared/kyc-core/sections.ts`, `shared/client/kycSteps.ts`, `src/portal/kyc/`,
    `mobile/src/components/GuidedCamera.tsx`, `src/routes/requestLimit.ts`
  - deleted (already staged): `src/portal/pages/KycPage.tsx`
  - new dependencies: `@aws-sdk/client-rekognition` (web/server), `expo-camera` (mobile)

## Step 2 — Run every check. Don't commit if any of them fail.
1. `npm run lint`
2. `npm test`
3. `npm run build`
4. In `mobile/`: `npx tsc --noEmit`

If something fails, show me the error and the fix you propose. Only fix it if the fix is
small and clearly part of the KYC work. Then rerun all four checks.

## Step 3 — Review what's about to be committed
Report each of these to me:
1. **Unrelated changes.** For every changed file, say whether it belongs to KYC guided
   verification. Look closely at `src/portal/pages/ApplyLoanPage.tsx`,
   `src/portal/pages/DashboardPage.tsx`, `src/routes/branchRoutes.ts`, `server.ts`,
   `src/db/index.ts`, and `src/admin/*`. If one isn't KYC work, it goes in its own commit.
2. **The deleted `KycPage.tsx`.** Confirm nothing imports it anymore and that the portal
   route now points to the new `src/portal/kyc/` flow.
3. **Secrets and personal data.** Must not be committed:
   - `.env` files or real keys (especially `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`
     and Supabase service keys)
   - `uploads/`, `.data/`, `database/backups/`, `*.log`
   - any real ID photo, selfie, or face image, including in test fixtures (synthetic
     test data only)

   Search the diff for key patterns (`AKIA`, `sk_`, `service_role`, `eyJ` JWTs). Check
   that `.env.example` has empty values only.
4. **Lock files.** Make sure `package-lock.json` and `mobile/package-lock.json` only
   changed because of the two new dependencies.
5. **Line endings.** Ignore the LF/CRLF warnings. Don't reformat or convert files. Commit
   them as they are.
6. **Prompt docs.** `docs/SECURITY_FIX_PROMPT.md` and `docs/COMMIT_KYC_PROMPT.md` aren't
   KYC code. Commit them separately as `docs: add security-fix and commit prompts`.

## Step 4 — Propose a commit plan, then stop
Group the work into a few logical commits, with each commit passing `npm run lint` on
its own. For example:
1. `feat(kyc): shared guided-capture rules (sections, live frame, steps) with tests`
   for `shared/kyc-core/*`, `shared/client/*`
2. `feat(kyc): server face verification and KYC request limits` for `src/kyc/*`,
   `src/routes/clientKycRoutes.ts`, `src/routes/requestLimit.ts`, `server.ts`,
   `.env.example`, `package.json`, lock file
3. `feat(kyc): guided verification flow in the web portal` for `src/portal/kyc/`,
   portal routes and pages, removing `KycPage.tsx`
4. `feat(kyc): guided camera in the mobile app` for `mobile/*`
5. `feat(kyc): branch and admin review shows face-match results` for
   `src/components/kyc/*`, `src/admin/*`, `src/branch/*`
6. `docs(kyc): update KYC_FLOW.md`

If the files are too intertwined to split cleanly, propose one commit instead and say why.
Match the message style of earlier commits (`feat(kyc): ...`, `fix(...)`). Each message
body says what changed and why in 2–5 lines.

**Show me the plan (files per commit and each message) and wait for my "ok".**

## Step 5 — Commit (after I say ok)
- **Stage only the files listed.** Stage files explicitly. No `git add -A` or `git add .`.
- **No shortcuts.** Don't use `--no-verify`. Don't amend existing commits. Don't
  force-push.
- **Afterwards:** show `git log --oneline main..HEAD` and `git status`. The working tree
  should be clean.

## Step 6 — Push and PR (ask me first)
Ask me before pushing. If I say yes:
- **Push:** `git push -u origin feat/kyc-guided-verification`.
- **Open a PR into `main`.** Don't merge it. The description includes:
  - what the feature does (guided ID and selfie capture, live-frame checks, automated
    face match, staff review)
  - how it was tested (the check results from Step 2)
  - **new dependencies:** `@aws-sdk/client-rekognition`, `expo-camera`
  - **new env vars:** `FACE_VERIFICATION_PROVIDER`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
    `AWS_SECRET_ACCESS_KEY`, `FACE_MATCH_MIN_SIMILARITY`, `KYC_LOCAL_STORAGE_DIR`
  - **privacy note:** when `FACE_VERIFICATION_PROVIDER=aws-rekognition` is set, member
    selfies and ID photos are sent to AWS for comparison. That's biometric personal data
    under the Data Privacy Act (RA 10173), so members must be told and consent recorded.
    Without the setting, a branch officer compares the faces manually.

## Final report
List the commits made, whether you pushed, the PR link if one was opened, and anything
skipped or not verified.
