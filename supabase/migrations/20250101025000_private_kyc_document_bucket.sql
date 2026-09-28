-- ============================================================
-- 0018 - PRIVATE THE KYC DOCUMENT BUCKET
--        (independent of the schema chain; applies on its own)
--
-- Idempotent. Safe to re-run. Touches exactly one row of
-- storage.buckets. Inserts and deletes nothing.
--
-- Why:
--   Migration 0011 created 'kyc-documents' with public = FALSE
--   and four storage.objects policies that scope every read to
--   the owning client or an allow-listed staff role. Those
--   policies are the entire access-control story for this
--   bucket, and a public bucket bypasses all of them: with
--   public = true, any object is readable by unauthenticated
--   request at
--     /storage/v1/object/public/kyc-documents/<path>
--   and the four policies are never consulted.
--
--   The live bucket is public. It was created outside migration
--   0011 (owner IS NULL, and a created_at later than the
--   migration's own application), and because 0011 uses
--   INSERT ... ON CONFLICT DO NOTHING, re-running 0011 never
--   corrects the flag. ON CONFLICT DO NOTHING is correct for
--   creating the bucket and wrong for constraining it, which is
--   why the drift was never repaired.
--
--   Nothing in the app depends on the bucket being public. All
--   three read paths already mint scoped URLs:
--     src/db/documentStorage.ts:129   createSignedUrl(30 min)
--     src/routes/clientMobileRoutes.ts:71  createSignedUrl
--     src/routes/branchRoutes.ts:1999      createSignedUrl(10 min)
--   getPublicUrl is never called. So this is a pure leak with
--   no functional upside.
--
-- Blast radius at time of writing: zero stored objects, so no
-- data is currently exposed. This closes the exposure on the
-- FIRST upload rather than after one.
--
-- Scope note: this file corrects ONLY the public flag. The live
-- bucket's allowed_mime_types also drifted from 0011 (it
-- permits application/pdf, which 0011 does not). Narrowing that
-- list could reject uploads the running app accepts, so it is
-- deliberately left alone. file_size_limit is likewise left as
-- found rather than reset to 0011's value.
-- ============================================================

BEGIN;

-- The bucket may not exist at all if 0011 was never applied.
-- Nothing to constrain in that case; do not fail the run.
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'kyc-documents'
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE NOTICE
      '0018: storage.buckets ''kyc-documents'' not present, nothing to secure.';
    RETURN;
  END IF;

  UPDATE storage.buckets
     SET public = FALSE
   WHERE id = 'kyc-documents'
     AND public IS DISTINCT FROM FALSE;

  IF FOUND THEN
    RAISE NOTICE '0018: set storage.buckets ''kyc-documents'' to private.';
  ELSE
    RAISE NOTICE '0018: ''kyc-documents'' already private, no change.';
  END IF;
END
$$;

-- Post-condition, so an applied run is self-verifying rather
-- than merely silent. A SELECT does not raise on failure, so
-- the guard is explicit.
DO $$
DECLARE
  v_public boolean;
BEGIN
  SELECT public INTO v_public
    FROM storage.buckets
   WHERE id = 'kyc-documents';

  IF v_public IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION
      '0018: ''kyc-documents'' is still public (public = %). Aborting.',
      coalesce(v_public::text, 'NULL');
  END IF;
END
$$;

COMMIT;
