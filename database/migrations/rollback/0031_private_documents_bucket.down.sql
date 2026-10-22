-- Rollback of 0031_private_documents_bucket.sql.
--
-- Makes the 'documents' bucket public again, as it was before 0031. That
-- re-opens every object in it to anyone who knows its path, so only roll back
-- if a client truly needs direct public access. 0031 dropped no policy on the
-- production project (it had none on storage.objects), so none is restored.

BEGIN;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    UPDATE storage.buckets SET public = true WHERE id = 'documents';
  END IF;
END
$$;

COMMIT;
