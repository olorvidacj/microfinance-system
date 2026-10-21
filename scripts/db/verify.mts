/**
 * Builds a throwaway database from database/migrations alone (in memory, no
 * server needed) and checks that every table and column the code declares in
 * Drizzle exists with a compatible type and nullability.
 *
 *   npm run db:verify
 */
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { is } from 'drizzle-orm';
import { PgTable as PgTableClass } from 'drizzle-orm/pg-core';
import { createLocalDatabase } from '../../src/db/testing/localDatabase';
import * as legacy from '../../src/db/schema';
import * as lending from '../../src/lending/tables';
import * as savings from '../../src/savings/tables';
import * as groups from '../../src/groups/tables';

const pg = await createLocalDatabase();
const cols = (
  await pg.query<{ schema: string; table: string; column: string; type: string; nullable: string }>(
    `select table_schema as schema, table_name as table, column_name as column, data_type as type, is_nullable as nullable
       from information_schema.columns where table_schema not in ('pg_catalog', 'information_schema')`,
  )
).rows;
const byTable = new Map<string, Map<string, { type: string; nullable: boolean }>>();
for (const c of cols) {
  const key = `${c.schema}.${c.table}`;
  if (!byTable.has(key)) byTable.set(key, new Map());
  byTable.get(key)!.set(c.column, { type: c.type, nullable: c.nullable === 'YES' });
}

// Drizzle data types -> information_schema data types that hold them.
const COMPATIBLE: Record<string, string[]> = {
  string: ['text', 'character varying', 'character', 'USER-DEFINED', 'date', 'numeric', 'uuid', 'time without time zone', 'timestamp with time zone', 'timestamp without time zone'],
  number: ['integer', 'bigint', 'smallint', 'double precision', 'real', 'numeric'],
  boolean: ['boolean'],
  date: ['timestamp without time zone', 'timestamp with time zone', 'date'],
  json: ['jsonb', 'json'],
  array: ['ARRAY'],
  bigint: ['bigint'],
  custom: ['numeric', 'text', 'USER-DEFINED', 'bigint', 'integer'],
};

const problems: string[] = [];
const seen = new Set<string>();
let tables = 0;
let columns = 0;
for (const mod of [legacy, lending, savings, groups]) {
  for (const value of Object.values(mod)) {
    if (!is(value, PgTableClass)) continue;
    const cfg = getTableConfig(value as PgTable);
    const key = `${cfg.schema ?? 'public'}.${cfg.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tables++;
    const live = byTable.get(key);
    if (!live) {
      problems.push(`table ${key} is declared in Drizzle but no migration creates it`);
      continue;
    }
    for (const col of cfg.columns) {
      columns++;
      const c = live.get(col.name);
      if (!c) {
        problems.push(`column ${key}.${col.name} is missing`);
        continue;
      }
      const ok = (COMPATIBLE[col.dataType] ?? []).includes(c.type);
      if (!ok) problems.push(`column ${key}.${col.name}: Drizzle ${col.dataType} (${col.getSQLType()}) vs database ${c.type}`);
      if (col.notNull && c.nullable) problems.push(`column ${key}.${col.name}: NOT NULL in Drizzle, nullable in the database`);
    }
  }
}
await pg.close();
console.log(`[db:verify] ${tables} Drizzle tables, ${columns} columns checked against a database built from migrations.`);
if (problems.length) {
  console.log(problems.map((p) => `  - ${p}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('[db:verify] every declared table and column exists with a compatible type.');
}
