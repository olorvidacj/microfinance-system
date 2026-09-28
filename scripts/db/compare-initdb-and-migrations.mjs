/**
 * Compares the table definitions in src/db/initDb.ts against
 * database/migrations/*.sql and reports which tables disagree.
 *
 * The database is built by initDb.ts at boot, while database/migrations is a
 * parallel hand-run set with no tracking table. Where both define a table, the
 * two shapes must agree or the schema silently depends on which ran last.
 *
 *   node scripts/db/compare-initdb-and-migrations.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const INIT_DB = path.join(REPO_ROOT, 'src/db/initDb.ts');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'database/migrations');

/**
 * Extracts CREATE TABLE blocks keyed by table name, returning column names.
 * Strips comments first and only accepts lines that begin with an identifier
 * followed by a type, so inline DEFAULT lpad(...) expressions and constraint
 * lines are not mistaken for columns.
 */
function parseTables(sql) {
  const stripped = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Map();
  const re = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\s*\);/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const [, name, body] = m;
    const columns = body
      .split('\n')
      .map((l) => l.trim())
      .map((l) => (/^"?(\w+)"?\s+[A-Za-z]/.exec(l) || [])[1])
      .filter(Boolean)
      .map((c) => c.toLowerCase())
      .sort();
    out.set(name.toLowerCase(), columns);
  }
  return out;
}

const initSql = await readFile(INIT_DB, 'utf8');
const initTables = parseTables(initSql);

const migTables = new Map();
const migrationFiles = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
for (const file of migrationFiles) {
  const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
  for (const [name, cols] of parseTables(sql)) {
    if (migTables.has(name)) migTables.get(name).files.push(file);
    else migTables.set(name, { columns: cols, files: [file] });
  }
}

const onlyInit = [...initTables.keys()].filter((t) => !migTables.has(t)).sort();
const onlyMig = [...migTables.keys()].filter((t) => !initTables.has(t)).sort();
const both = [...initTables.keys()].filter((t) => migTables.has(t)).sort();

console.log(`initDb.ts defines ${initTables.size} tables`);
console.log(`migrations define ${migTables.size} tables across ${migrationFiles.length} files\n`);

console.log(`\n=== only in initDb.ts (${onlyInit.length}) ===`);
console.log(`No migration can create these, so a migration-only deploy is broken:`);
onlyInit.forEach((t) => console.log(`  ${t}`));

console.log(`\n=== only in migrations (${onlyMig.length}) ===`);
onlyMig.forEach((t) => console.log(`  ${t}  (${migTables.get(t).files.join(', ')})`));

console.log(`\n=== defined in both (${both.length}) ===`);
let conflicts = 0;
for (const t of both) {
  const a = initTables.get(t);
  const b = migTables.get(t).columns;
  if (a.join(',') === b.join(',')) continue;
  conflicts++;
  const onlyInitCols = a.filter((c) => !b.includes(c));
  const onlyMigCols = b.filter((c) => !a.includes(c));
  console.log(`\n  CONFLICT ${t}  (migration: ${migTables.get(t).files.join(', ')})`);
  if (onlyInitCols.length) console.log(`    initDb only:     ${onlyInitCols.join(', ')}`);
  if (onlyMigCols.length) console.log(`    migrations only: ${onlyMigCols.join(', ')}`);
}
if (!conflicts) console.log('\n  All overlapping tables have identical column sets.');

console.log(
  `\nsummary: ${onlyInit.length} initDb-only, ${onlyMig.length} migration-only, ` +
  `${both.length} shared, ${conflicts} with conflicting columns.`,
);
