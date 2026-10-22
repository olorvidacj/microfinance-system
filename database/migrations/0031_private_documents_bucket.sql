-- ============================================================
-- 0031 - No public storage buckets
--
-- Requires: 0023.
--
-- The 'documents' bucket was created public outside the migrations, and
-- 0023 left its flag as it found it. In a public bucket anyone who knows an
-- object's path can download it from /storage/v1/object/public/documents/...,
-- whatever the policies say. No code reads or writes this bucket (branch and
-- member documents live in the private 'kyc-documents' bucket and are served
-- through short-lived signed links), and it held no objects on 2026-10-23.
--
-- 1. 'documents' becomes private (when it exists).
-- 2. Any storage policy that grants access to 'documents' is dropped. The
--    server uses the service-role key, so no client needs direct access.
-- 3. The migration refuses to finish while any bucket is still public. A
--    public bucket other than 'documents' is reported, not changed: it needs
--    a decision of its own.
--
-- On plain Postgres (local and test databases) the storage schema may be a
-- stand-in or missing; each step is skipped when its table is absent.
--
-- Rollback: rollback/0031_private_documents_bucket.down.sql
-- ============================================================

BEGIN;

DO $$
DECLARE
  p record;
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    UPDATE storage.buckets SET public = false WHERE id = 'documents' AND public IS DISTINCT FROM false;
  END IF;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    -- A policy naming the bucket shows it as 'documents'::text; 'kyc-documents' does not match.
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '''documents'''
    LOOP
      EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
      RAISE NOTICE '0031: dropped storage policy % (it granted access to the documents bucket)', p.policyname;
    END LOOP;
  END IF;
END
$$;

DO $$
DECLARE
  v_public text;
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    SELECT string_agg(id, ', ' ORDER BY id) INTO v_public FROM storage.buckets WHERE public IS DISTINCT FROM false;
    IF v_public IS NOT NULL THEN
      RAISE EXCEPTION '0031: these storage buckets are still public: %. Aborting.', v_public;
    END IF;
  END IF;
END
$$;

COMMIT;
