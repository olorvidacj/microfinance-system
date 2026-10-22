-- Rollback of 0029_ledger_immutable.sql: posted journal rows can be changed again.

BEGIN;

DROP TRIGGER IF EXISTS trg_journal_entries_no_truncate ON journal_entries;
DROP TRIGGER IF EXISTS trg_journal_entries_immutable ON journal_entries;
DROP TRIGGER IF EXISTS trg_journal_lines_no_truncate ON journal_entry_lines;
DROP TRIGGER IF EXISTS trg_journal_lines_immutable ON journal_entry_lines;
DROP FUNCTION IF EXISTS forbid_ledger_change();

COMMIT;
