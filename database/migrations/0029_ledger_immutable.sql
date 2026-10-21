-- 0029 ledger immutability
--
-- A posted journal entry and its lines are never changed or deleted; a
-- correction is a new, reversing entry (as payment reversals already do).
-- Until now only trg_entry_balanced guarded the lines, and it accepts the
-- removal of every line of an entry (0 = 0), so the ledger could be erased
-- with a plain DELETE. No application path updates or deletes these rows.
--
-- Rollback: rollback/0029_ledger_immutable.down.sql

BEGIN;

CREATE OR REPLACE FUNCTION forbid_ledger_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Posted journal records are never changed or deleted (% on %); post a reversing entry instead.', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_lines_immutable ON journal_entry_lines;
CREATE TRIGGER trg_journal_lines_immutable
  BEFORE UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_change();

DROP TRIGGER IF EXISTS trg_journal_lines_no_truncate ON journal_entry_lines;
CREATE TRIGGER trg_journal_lines_no_truncate
  BEFORE TRUNCATE ON journal_entry_lines
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_ledger_change();

DROP TRIGGER IF EXISTS trg_journal_entries_immutable ON journal_entries;
CREATE TRIGGER trg_journal_entries_immutable
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_change();

DROP TRIGGER IF EXISTS trg_journal_entries_no_truncate ON journal_entries;
CREATE TRIGGER trg_journal_entries_no_truncate
  BEFORE TRUNCATE ON journal_entries
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_ledger_change();

COMMIT;
