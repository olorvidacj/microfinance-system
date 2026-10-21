import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createLocalDatabase } from './testing/localDatabase';
import { migrationChain, pendingMigrations, runMigrations, type MigrationTarget } from './migrations';

const target = (pg: PGlite): MigrationTarget => ({
  exec: async (sql) => {
    await pg.exec(sql);
  },
  query: async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows,
});

let pg: PGlite;

beforeAll(async () => {
  pg = await createLocalDatabase();
}, 120_000);

afterAll(async () => {
  await pg?.close();
});

describe('building a database from database/migrations', () => {
  it('applies every file in APPLY_ORDER.txt once and records it', async () => {
    const recorded = (await pg.query<{ file: string }>('select file from schema_migrations order by file')).rows.map((r) => r.file);
    expect(recorded.sort()).toEqual([...migrationChain()].sort());
    expect(await pendingMigrations(target(pg))).toEqual([]);
    expect(await runMigrations(target(pg))).toEqual([]);
  });

  it('refuses an existing, untracked database unless told what it already has', async () => {
    const legacy = new PGlite();
    await legacy.exec('create table users (id text primary key)');
    await expect(runMigrations(target(legacy))).rejects.toThrow(/--baseline-through/);
    const ran = await runMigrations(target(legacy), { baselineThrough: migrationChain().at(-1) });
    expect(ran).toEqual([]);
    expect((await legacy.query<{ n: number }>('select count(*)::int n from schema_migrations')).rows[0].n).toBe(migrationChain().length);
    await legacy.close();
  });
});

describe('the ledger is append-only (0029)', () => {
  it('posted journal lines and entries cannot be changed, deleted or truncated', async () => {
    const [account] = (await pg.query<{ account_id: string }>("select account_id from accounts where account_code = '1110'")).rows;
    const [cash] = (await pg.query<{ account_id: string }>("select account_id from accounts where account_code = '1010'")).rows;
    await pg.exec('BEGIN');
    const [entry] = (await pg.query<{ id: string }>(`insert into journal_entries (entry_date, description, source_module) values (current_date, 'test', 'test') returning journal_entry_id as id`)).rows;
    await pg.query('insert into journal_entry_lines (entry_id, line_number, account_id, debit) values ($1, 1, $2, 100)', [entry.id, account.account_id]);
    await pg.query('insert into journal_entry_lines (entry_id, line_number, account_id, credit) values ($1, 2, $2, 100)', [entry.id, cash.account_id]);
    await pg.exec('COMMIT');

    await expect(pg.query('delete from journal_entry_lines where entry_id = $1', [entry.id])).rejects.toThrow(/never changed or deleted/);
    await expect(pg.query('update journal_entry_lines set debit = 1 where entry_id = $1 and line_number = 1', [entry.id])).rejects.toThrow(/never changed or deleted/);
    await expect(pg.query('delete from journal_entries where journal_entry_id = $1', [entry.id])).rejects.toThrow(/never changed or deleted/);
    await expect(pg.query('truncate journal_entry_lines')).rejects.toThrow(/never changed or deleted/);
  });
});
