/**
 * Migration verification harness.
 *
 * Applies the migration chain to a scratch database and reports the outcome, so
 * a broken migration is caught before it ever reaches a real environment. Never
 * touches the application database.
 *
 *   node scripts/db/verify-migrations.mjs              # create scratch db, migrate, drop
 *   node scripts/db/verify-migrations.mjs --keep       # keep the scratch db for inspection
 *   node scripts/db/verify-migrations.mjs --from 0019 # start at a specific migration
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { createConnectionString } from './db-url.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, '../../database/migrations');
const SCRATCH_DB = 'hoscomco_kyc_migration_check';

const keep = process.argv.includes('--keep');
const fromIdx = process.argv.indexOf('--from');
const fromArg = fromIdx > -1 ? process.argv[fromIdx + 1] : null;

// The repository contains two mutually incompatible data models. See
// scripts/db/compare-initdb-and-migrations.mjs for the comparison.
//
//   model-a  the live one: borrowers/staff/branches/users, loans.borrower_id.
//            Built by src/db/initDb.ts at boot, and extended by migrations
//            0011-0018. All application code targets this.
//
//   model-b  a dead Supabase prototype: profiles/clients/client_kyc,
//            loans.client_id. Migrations 0001-0010. No code path writes to it.
//
// `--base model-a` replays only the lineage the application actually uses, so
// new KYC migrations are verified against a realistic database instead of one
// whose loans table has the wrong foreign key.
const baseIdx = process.argv.indexOf('--base');
const base = baseIdx > -1 ? process.argv[baseIdx + 1] : 'all';

async function main() {
  const admin = createConnectionString({ database: 'postgres' });
  const scratch = createConnectionString({ database: SCRATCH_DB });

  const root = new Client({ connectionString: admin, ssl: { rejectUnauthorized: false } });
  await root.connect();

  // Never resume into a dirty schema: a partial prior run would make failures
  // ambiguous.
  await root.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
  await root.query(`CREATE DATABASE ${SCRATCH_DB}`);
  console.log(`created scratch database ${SCRATCH_DB}\n`);

  const client = new Client({ connectionString: scratch, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Migrations 0001-0010 target Supabase, whose `auth` and `storage` schemas
  // are created by the platform rather than by this chain. Replaying them
  // against plain Postgres needs a stand-in with the same surface.
  await applySupabasePrelude(client);
  console.log('  applied Supabase auth/storage prelude\n');

  if (base === 'model-a') {
    await applyInitDbSchema(client);
    console.log('  applied src/db/initDb.ts schema (model A)\n');
  }
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  // Under model A the 0001-0010 prototype migrations are skipped: they build
  // loans/savings_products/audit_logs with different columns than the tables
  // initDb.ts just created, so applying them would replace live-shaped tables
  // with dead-model ones.
  const skipped = base === 'model-a' && !fromArg;
  const selected = skipped
    ? files.filter((f) => f >= '0011_kyc_full_schema.sql')
    : fromArg
      ? files.filter((f) => f >= fromArg)
      : files;

  if (skipped) console.log('  skipping 0001-0010 (dead Supabase prototype, superseded by initDb.ts)\n');

  // 0021 rewrites existing rows, so it is the one migration that must be
  // exercised against realistic input rather than an empty table. It is applied
  // in a second pass, after legacy rows have been planted.
  const BACKFILL_FILE = '0021_kyc_backfill_and_status_remap.sql';
  const backfillIdx = selected.findIndex((f) => f === BACKFILL_FILE);
  const preBackfill = backfillIdx > -1 ? selected.slice(0, backfillIdx) : selected;
  const postBackfill = backfillIdx > -1 ? selected.slice(backfillIdx) : [];

  const failures = [];
  await applyFiles(client, preBackfill, failures);
  if (failures.length) { /* reported below */ }
  else if (postBackfill.length) {
    console.log('  planting legacy JSONB-era data …\n');
    await seedLegacyFixture(client);
    await applyFiles(client, postBackfill, failures);
  }

  if (!failures.length) {
    console.log('\nverifying schema invariants …');
    await verify(client);
    if (!failures.length) {
      console.log('\nverifying constraints actually reject bad data …');
      const rejected = await verifyBehaviour(client);
      if (rejected) failures.push({ file: 'behaviour', message: 'constraint did not reject invalid data' });
    }
    if (!failures.length) {
      console.log('\nverifying the KYC migrations are re-runnable …');
      const notIdempotent = await verifyIdempotent(client, files);
      if (notIdempotent.length) {
        failures.push({ file: 'idempotency', message: `${notIdempotent.length} migration(s) not re-runnable` });
      }
    }
    if (!failures.length && postBackfill.length) {
      console.log('\nverifying the backfill …');
      const wrong = await verifyBackfill(client);
      if (wrong) failures.push({ file: 'backfill', message: `${wrong} backfill assertion(s) failed` });
    }
  }

  await client.end();
  await root.end();

  if (!keep) {
    const r2 = new Client({ connectionString: admin, ssl: { rejectUnauthorized: false } });
    await r2.connect();
    await r2.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await r2.end();
    console.log(`\ndropped ${SCRATCH_DB}`);
  } else {
    console.log(`\nkept ${SCRATCH_DB} for inspection`);
  }

  process.exit(failures.length ? 1 : 0);
}

/**
 * Replays a failing migration one statement at a time to identify which
 * statement is at fault, since PostgreSQL reports a batch failure without
 * saying where in the file it happened.
 *
 * Statements before the failure have already been applied, so this runs inside a
 * transaction that is rolled back and leaves no trace.
 */
async function locateFailingStatement(client, sql, originalError) {
  let statements;
  try {
    statements = splitStatements(sql);
  } catch {
    return null;
  }

  await client.query('BEGIN');
  let culprit = null;
  try {
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
      } catch (err) {
        // The first statement whose error matches the batch failure is the one
        // that broke the whole migration.
        if (!culprit) {
          culprit = { index: i + 1, statement: statements[i].trim(), message: err.message };
        }
        break;
      }
    }
  } finally {
    await client.query('ROLLBACK');
  }
  return culprit;
}

/** Applies a list of migration files, recording the first failure. */
async function applyFiles(client, files, failures) {
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const started = Date.now();
    try {
      await client.query(sql);
      console.log(`  ok    ${file}  (${Date.now() - started}ms)`);
    } catch (err) {
      console.log(`  FAIL  ${file}\n        ${err.message}`);
      const where = await locateFailingStatement(client, sql, err);
      if (where) console.log(`        offending statement #${where.index}:\n${indent(where.statement, '        ')}`);
      failures.push({ file, message: err.message, position: err.position, where });
      return;
    }
  }
}

/**
 * Plants the kind of rows the legacy flow actually produced: unconstrained TEXT
 * statuses, free-text addresses with no PSGC codes, JSONB blobs with missing
 * fields, and document uploads that only ever had a signed URL.
 *
 * The point is the awkward cases. A backfill tested only on tidy data proves
 * nothing, because the tidy data is the part that was never in doubt.
 */
async function seedLegacyFixture(client) {
  const now = '2026-01-15T10:00:00.000Z';

  const borrowers = [
    // PENDING is the value the old submit handler wrote for every submission.
    ['brn-legacy-1', 'L-0001', 'VERIFIED', 'ACTIVE'],
    // Legacy spellings that need remapping; borrower and submission agree.
    ['brn-legacy-2', 'L-0002', 'PENDING', 'ACTIVE'],
    ['brn-legacy-3', 'L-0003', 'NOT_STARTED', 'ACTIVE'],
    // Approved on the borrower row but no submission backs it: must NOT survive
    // as APPROVED, or a fabricated approval unlocks a loan.
    ['brn-legacy-4', 'L-0004', 'VERIFIED', 'ACTIVE'],
    // member_status must not be touched by the remap.
    ['brn-legacy-5', 'L-0005', 'NOT_STARTED', 'SUSPENDED'],
    // A status nobody has seen before, to exercise the safe fallback.
    ['brn-legacy-6', 'L-0006', 'PENDING_V2', 'ACTIVE'],
    // Borrower row claims VERIFIED while the only submission is PENDING. The
    // pair is self-contradictory and must not resolve to APPROVED.
    ['brn-legacy-7', 'L-0007', 'VERIFIED', 'ACTIVE'],
  ];

  for (const [id, number, kycStatus, memberStatus] of borrowers) {
    await client.query(
      `INSERT INTO borrowers
         (id, borrower_number, full_name, id_number, phone, email, date_of_birth,
          gender, civil_status, address, branch_id, employment_status,
          employer_or_business, occupation, monthly_income, monthly_expenses,
          credit_score, credit_tier, kyc_status, member_status, membership_date,
          avatar, joined_date, last_activity_date)
       VALUES ($1,$2,'Legacy Person','L-ID','+639171234567','l@example.com',
               '1988-05-05','male','single','somewhere','br-1','employed','emp','job',
               1000,100,500,'A',$3,$4,'2020-01-01','','2020-01-01','2020-01-01')
       ON CONFLICT (id) DO NOTHING`,
      [id, number, kycStatus, memberStatus],
    );
  }

  const submissions = [
    // Complete personal data plus a free-text address: personal migrates, address does not.
    ['KYC-LEGACY-1', 'brn-legacy-1', 'VERIFIED', {
      firstName: 'Juan', middleName: 'Dela', hasMiddleName: true, lastName: 'Cruz',
      dateOfBirth: '1988-05-05', sex: 'male', civilStatus: 'married',
      placeOfBirth: 'Manila', nationality: 'FILIPINO', citizenship: 'FILIPINO',
    }, { houseUnit: '12', street: 'Acme St', barangay: 'San Isidro', city: 'Quezon City', province: 'Metro Manila', postalCode: '1100' }],
    // Missing placeOfBirth and nationality: personal must NOT be fabricated.
    ['KYC-LEGACY-2', 'brn-legacy-2', 'PENDING', {
      firstName: 'Maria', lastName: 'Reyes', dateOfBirth: '1990-02-02', gender: 'female',
    }, { houseUnit: '8', street: 'Rizal Ave', barangay: 'Barangay West', city: 'Cebu City', province: 'Cebu', postalCode: '6000' }],
    // Nothing started.
    ['KYC-LEGACY-3', 'brn-legacy-3', 'NOT_STARTED', null, null],
    // Backed by no submission: borrower claims VERIFIED with nothing behind it.
    // (No kyc_submissions row for brn-legacy-4.)
    // Unknown status.
    ['KYC-LEGACY-5', 'brn-legacy-5', 'PENDING_V2', {
      firstName: 'Ana', lastName: 'Lim', dateOfBirth: '1975-09-09', gender: 'female',
      civilStatus: 'single', placeOfBirth: 'Cebu', nationality: 'FILIPINO',
    }, { houseUnit: '3', street: 'Mabini St', barangay: 'Poblacion', city: 'Davao City', province: 'Davao del Sur', postalCode: '8000' }],
    ['KYC-LEGACY-6', 'brn-legacy-6', 'REJECTED', {
      firstName: 'Ben', lastName: 'Torres', dateOfBirth: '1995-12-12', sex: 'male',
      civilStatus: 'single', placeOfBirth: 'Iloilo', nationality: 'FILIPINO',
    }, { houseUnit: '1', street: 'Lopez St', barangay: 'Mandinga', city: 'Quezon City', province: 'Metro Manila', postalCode: '1103' }],
    ['KYC-LEGACY-7', 'brn-legacy-7', 'PENDING', {
      firstName: 'Rosa', lastName: 'Lim', dateOfBirth: '1980-03-03', sex: 'female',
      civilStatus: 'married', placeOfBirth: 'Manila', nationality: 'FILIPINO',
    }, { houseUnit: '2', street: 'Bonifacio St', barangay: 'San Juan', city: 'Makati', province: 'Metro Manila', postalCode: '1200' }],
  ];

  for (const [id, borrowerId, status, personal, address] of submissions) {
    await client.query(
      `INSERT INTO kyc_submissions
         (id, borrower_id, status, personal_info, address, employment,
          submitted_at, reviewed_at, reviewed_by, reviewed_by_name,
          rejection_reason, verified_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'rev-1','Reviewer',$9,$10,$11,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        id, borrowerId, status,
        personal ? JSON.stringify(personal) : null,
        address ? JSON.stringify(address) : null,
        JSON.stringify({ status: 'EMPLOYED', company: 'Legacy Co', position: 'Staff' }),
        status === 'NOT_STARTED' ? null : now,
        ['VERIFIED', 'REJECTED', 'PENDING_V2'].includes(status) ? now : null,
        status === 'REJECTED' ? 'Documents were illegible' : null,
        status === 'VERIFIED' ? now : null,
        now,
      ],
    );
  }

  // Document rows: one with a signed URL, one without any URL at all, and one
  // whose document_type is not in the new catalogue.
  const docs = [
    ['KYC-DOC-1', 'KYC-LEGACY-1', 'brn-legacy-1', 'proof_of_address', 'Utility Bill.pdf', 'https://signed.example.com/kyc/1?token=abc', 'PENDING'],
    ['KYC-DOC-2', 'KYC-LEGACY-1', 'brn-legacy-1', 'selfie', 'Selfie.jpg', null, 'PENDING'],
    ['KYC-DOC-3', 'KYC-LEGACY-2', 'brn-legacy-2', 'weird_unmapped_type', 'Mystery.pdf', 'https://signed.example.com/kyc/3?token=xyz', 'PENDING'],
  ];
  for (const [id, subId, borrowerId, type, fileName, fileUrl, status] of docs) {
    await client.query(
      `INSERT INTO kyc_documents_legacy
         (id, kyc_submission_id, borrower_id, document_type, document_name,
          file_name, file_url, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [id, subId, borrowerId, type, 'Legacy doc', fileName, fileUrl, status, now],
    );
  }
}

/**
 * Asserts that 0021 did what it claimed. Each case checks the outcome that
 * matters operationally: an approval must never be invented, a fabricated value
 * must never appear, and a legacy record must not vanish.
 */
async function verifyBackfill(client) {
  let bad = 0;
  const expect = async (label, actual, wanted) => {
    const ok = String(actual) === String(wanted);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` — got ${actual}, wanted ${wanted}`}`);
    if (!ok) bad++;
  };

  // Status remapping.
  const status = async (id) => {
    const r = await client.query('SELECT kyc_status FROM borrowers WHERE id = $1', [id]);
    return r.rows[0] ? r.rows[0].kyc_status : null;
  };
  await expect('legacy PENDING becomes SUBMITTED', await status('brn-legacy-2'), 'SUBMITTED');
  await expect('legacy VERIFIED becomes APPROVED', await status('brn-legacy-1'), 'APPROVED');
  await expect('unknown status falls back to NOT_STARTED', await status('brn-legacy-6'), 'NOT_STARTED');
  // brn-legacy-4 claimed VERIFIED with no submission behind it. This is the
  // case that matters: an unsupported approval must not survive the remap.
  await expect('unbacked VERIFIED is not left as APPROVED', await status('brn-legacy-4'), 'CORRECTION_REQUIRED');
  // brn-legacy-7 is self-contradictory: the borrower says VERIFIED, the only
  // submission says PENDING. Resolving that to APPROVED would be inventing an
  // approval out of a contradiction.
  await expect('contradictory VERIFIED/PENDING pair is not resolved to APPROVED',
    await status('brn-legacy-7'), 'CORRECTION_REQUIRED');

  const memberStatus = async (id) => {
    const r = await client.query('SELECT member_status FROM borrowers WHERE id = $1', [id]);
    return r.rows[0] ? r.rows[0].member_status : null;
  };
  await expect('member_status is left alone', await memberStatus('brn-legacy-5'), 'SUSPENDED');

  // Scoped to the legacy key so the behavioural fixtures created earlier in this
  // run do not contaminate the counts. The parent table keys on `id`; the child
  // tables reference it as `application_id`.
  const legacyIds = "id LIKE 'KYC-LEGACY-%'";
  const legacyApps = "application_id LIKE 'KYC-LEGACY-%'";

  const appCount = await client.query(
    `SELECT count(*)::int AS n FROM kyc_applications WHERE ${legacyIds}`);
  await expect('one application per legacy submission', appCount.rows[0].n, 6);

  const appStatus = await client.query(
    "SELECT status::text AS s FROM kyc_applications WHERE id = 'KYC-LEGACY-1'");
  await expect('application carries the remapped status', appStatus.rows[0].s, 'APPROVED');

  const snapshot = await client.query(
    "SELECT snapshot -> 'legacy_personal_info' ->> 'firstName' AS f FROM kyc_applications WHERE id = 'KYC-LEGACY-1'");
  await expect('legacy payload is preserved in the snapshot', snapshot.rows[0].f, 'Juan');

  // Personal: migrated only where complete.
  const personal = async (id) => {
    const r = await client.query(
      'SELECT first_name, place_of_birth, nationality FROM kyc_personal WHERE application_id = $1', [id]);
    return r.rows[0] || null;
  };
  const p1 = await personal('KYC-LEGACY-1');
  await expect('complete personal record migrates', p1 ? p1.first_name : null, 'Juan');
  const p2 = await personal('KYC-LEGACY-2');
  await expect('incomplete personal record is not fabricated', p2, null);

  // Addresses: never invented.
  const addrCount = await client.query(
    `SELECT count(*)::int AS n FROM kyc_addresses WHERE ${legacyApps}`);
  await expect('no address is backfilled from free text', addrCount.rows[0].n, 0);

  const corr = await client.query(
    `SELECT count(*)::int AS n FROM kyc_corrections
      WHERE section_key IN ('ADDRESS','PERSONAL') AND status = 'OPEN'`);
  if (corr.rows[0].n > 0) console.log(`  ok    corrections raised for the gaps (${corr.rows[0].n})`);
  else { console.log('  FAIL  no correction raised for the unresolved address'); bad++; }

  // Documents: mapped ones survive, unmapped ones are left out, and the ones
  // with no retrievable object are marked for re-upload.
  const docCount = await client.query(
    `SELECT count(*)::int AS n FROM kyc_documents
      WHERE ${legacyApps}`);
  await expect('only catalogue-matched documents migrate', docCount.rows[0].n, 2);

  const stale = await client.query(
    `SELECT count(*)::int AS n FROM kyc_documents
      WHERE legacy_reference IS NOT NULL
        AND ${legacyApps}`);
  await expect('documents with no retrievable object are flagged', stale.rows[0].n, 1);

  // Nothing from the legacy tables was destroyed.
  const legacyKept = await client.query('SELECT count(*)::int AS n FROM kyc_submissions');
  await expect('legacy submissions are retained', legacyKept.rows[0].n, 6);
  const legacyDocs = await client.query('SELECT count(*)::int AS n FROM kyc_documents_legacy');
  await expect('legacy documents are retained', legacyDocs.rows[0].n, 3);

  if (bad) console.log(`\n${bad} backfill assertion(s) failed.`);
  else console.log('\nthe backfill preserved what it could and invented nothing.');
  return bad;
}

const indent = (text, pad) =>
  text.length > 600 ? `${text.slice(0, 600)}\n${pad}… (truncated)` : text;

/**
 * Splits a SQL file into statements, respecting single quotes, double-quoted
 * identifiers, dollar-quoted bodies, line comments and block comments. Without
 * this, a `;` inside a function body or a comment would be treated as a split
 * point and the replay would fail in a misleading place.
 */
function splitStatements(sql) {
  const out = [];
  let buf = '';
  let i = 0;

  while (i < sql.length) {
    const rest = sql.slice(i);

    if (rest.startsWith('--')) {
      const nl = sql.indexOf('\n', i);
      const end = nl === -1 ? sql.length : nl;
      buf += sql.slice(i, end);
      i = end;
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }
    // Dollar quoting: $$ … $$ or $tag$ … $tag$
    const dollar = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(rest);
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      const q = sql[i];
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === q) {
          if (sql[j + 1] === q) { j += 2; continue; }
          break;
        }
        j++;
      }
      buf += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (sql[i] === ';') {
      out.push(buf);
      buf = '';
      i++;
      continue;
    }
    buf += sql[i];
    i++;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/**
 * Stand-in for the parts of a Supabase project the migration chain relies on:
 * the `auth` schema, the `auth.users` table, the `auth.uid()` / `auth.jwt()`
 * helper functions, and the `storage` schema used by the KYC document bucket.
 * Not a reimplementation of Supabase — only enough surface for the DDL to
 * resolve, and only ever created in a scratch database.
 */
async function applySupabasePrelude(client) {
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE TABLE IF NOT EXISTS auth.users (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email              TEXT UNIQUE,
      phone              TEXT,
      raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
      LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;

    -- Model B stand-in. 0011 creates model-A KYC tables (kyc_submissions keyed
    -- on borrower_id) but its storage policies check staff membership through
    -- profiles.role, which is a model-B table. The live database has users, not
    -- profiles, so the stub exists only so the DDL resolves during replay.
    CREATE TABLE IF NOT EXISTS public.profiles (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      role        TEXT,
      email       TEXT,
      is_active   BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE SCHEMA IF NOT EXISTS storage;

    CREATE TABLE IF NOT EXISTS storage.buckets (
      id                 TEXT PRIMARY KEY,
      name               TEXT NOT NULL,
      public             BOOLEAN NOT NULL DEFAULT FALSE,
      file_size_limit    BIGINT,
      allowed_mime_types TEXT[],
      created_at         TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS storage.objects (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id  TEXT REFERENCES storage.buckets(id),
      name       TEXT,
      owner      UUID,
      metadata   JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS storage_objects_bucket_idx ON storage.objects(bucket_id, name);

    CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
      RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
      SELECT string_to_array(regexp_replace(coalesce(name, ''), '/+$', ''), '/')
      $$;
  `);
}

/**
 * Executes the DDL that src/db/initDb.ts runs at boot.
 *
 * initDb.ts is the real source of truth for the live schema: it creates
 * borrowers, staff, branches and users, none of which any migration provides.
 * The statements live in plain template literals with no `${}` interpolation
 * (verified), so they can be extracted and run directly rather than
 * reimplementing them here and risking the two copies drifting apart.
 */
async function applyInitDbSchema(client) {
  const src = await readFile(path.join(HERE, '../../src/db/initDb.ts'), 'utf8');
  if (src.includes('${')) {
    throw new Error(
      'initDb.ts now interpolates into its DDL template literals; the extraction ' +
      'in applyInitDbSchema must be updated to run the real initDbSchema() instead.',
    );
  }
  const statements = [...src.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1]);
  if (!statements.length) throw new Error('no DDL template literals found in initDb.ts');

  for (const sql of statements) {
    if (!/\bCREATE\b|\bALTER\b|\bINSERT\b|\bDO\b/i.test(sql)) continue;
    await client.query(sql);
  }
  return statements.length;
}

/**
 * Re-applies the KYC migrations to confirm they are safe to run twice.
 *
 * There is no migration runner and no tracking table in this repository, so
 * migrations reach a database by being run by hand. That makes "what happens if
 * someone runs it again" a real question rather than a theoretical one: a
 * partially applied or retried migration is the normal failure mode, not the
 * exotic one. Each is re-run inside a transaction that is rolled back.
 *
 * Only the 0019+ KYC migrations are checked. The 0001-0010 prototype files use
 * bare CREATE TYPE, so they were never re-runnable and are not part of the live
 * lineage.
 */
async function verifyIdempotent(client, files) {
  const kycFiles = files.filter((f) => f >= '0019_kyc_core_and_geography.sql');
  const notReRunnable = [];

  for (const file of kycFiles) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      console.log(`  ok    ${file} — safe to re-run`);
    } catch (err) {
      console.log(`  FAIL  ${file} — re-run failed: ${err.message}`);
      notReRunnable.push(file);
    } finally {
      await client.query('ROLLBACK');
    }
  }
  return notReRunnable;
}

/**
 * Behavioural checks: each case asserts that the database *refuses* bad data.
 *
 * Verifying that a constraint exists proves nothing about whether it fires, and
 * a trigger that silently does nothing is the most dangerous failure mode here
 * -- it would let a hand-crafted request attach a Manila barangay to a Cebu
 * city, which is precisely what the no-skip requirement forbids. Every case
 * below is therefore negative: insert invalid data, expect an error.
 *
 * Returns the number of cases that failed to reject.
 */
async function verifyBehaviour(client) {
  let bad = 0;

  const setup = await seedFixture(client);

  /** Expects the statement to be rejected, and reports which way it went. */
  const rejects = async (label, sql, params) => {
    try {
      await client.query(sql, params);
      console.log(`  FAIL  ${label} — invalid data was ACCEPTED`);
      bad++;
    } catch (err) {
      console.log(`  ok    ${label} — rejected (${err.code || err.message.slice(0, 60)})`);
    }
  };

  const accepts = async (label, sql, params) => {
    try {
      await client.query(sql, params);
      console.log(`  ok    ${label} — accepted`);
    } catch (err) {
      console.log(`  FAIL  ${label} — valid data was rejected: ${err.message}`);
      bad++;
    }
  };

  // Geography: a province must sit inside its own region. Region 07 with a
  // province that belongs to region 01 is the genuinely invalid pairing.
  await rejects('city whose province belongs to another region',
    `INSERT INTO psgc_cities (code, region_code, province_code, name)
     VALUES ('999901', '07', '0123', 'Mismatched')`);

  await rejects('city referencing a province that does not exist',
    `INSERT INTO psgc_cities (code, region_code, province_code, name)
     VALUES ('999902', '01', '9999', 'No Such Province')`);

  await accepts('city with no province (NCR-style LGU)',
    `INSERT INTO psgc_cities (code, region_code, province_code, name, is_regional_district)
     VALUES ('999903', '13', NULL, 'Valid Regional LGU', TRUE)`);

  // Addresses: the hierarchy must be internally consistent.
  await rejects('barangay attached to a city in a different province',
    `INSERT INTO kyc_addresses
       (application_id, kind, region_code, province_code, city_code, barangay_code,
        postal_code, house_number, street)
     VALUES ($1, 'CURRENT', $2, $3, $4, $5, '1000', '1', 'Street')`,
    [setup.appId, setup.otherRegion, setup.otherProvince, setup.otherCity, setup.otherCityBarangay]);

  await rejects('barangay code that does not exist',
    `INSERT INTO kyc_addresses
       (application_id, kind, region_code, province_code, city_code, barangay_code,
        postal_code, house_number, street)
     VALUES ($1, 'CURRENT', $2, $3, $4, '999999', '1000', '1', 'Street')`,
    [setup.appId, setup.region, setup.province, setup.city]);

  await rejects('postal code outside the chosen city',
    `INSERT INTO kyc_addresses
       (application_id, kind, region_code, province_code, city_code, barangay_code,
        postal_code, house_number, street)
     VALUES ($1, 'CURRENT', $2, $3, $4, $5, '9999', '1', 'Street')`,
    [setup.appId, setup.region, setup.province, setup.city, setup.barangay]);

  // The same-address pair must agree, but only once the step is declared
  // finished. While the section is being filled in, either intermediate state is
  // legitimate, and rejecting them would break autosave.
  await accepts('fully consistent address, same-address question not yet answered',
    `INSERT INTO kyc_addresses
       (application_id, kind, region_code, province_code, city_code, barangay_code,
        postal_code, house_number, street)
     VALUES ($1, 'CURRENT', $2, $3, $4, $5, $6, '1', 'Street')`,
    [setup.appId, setup.region, setup.province, setup.city, setup.barangay, setup.postal]);

  await accepts('mid-step: answering FALSE before the permanent address is entered',
    `UPDATE kyc_addresses SET is_same_as_current = FALSE
      WHERE application_id = $1 AND kind = 'CURRENT'`, [setup.appId]);

  await accepts('mid-step: recording the permanent address afterwards',
    `INSERT INTO kyc_addresses
       (application_id, kind, region_code, province_code, city_code, barangay_code,
        postal_code, house_number, street)
     VALUES ($1, 'PERMANENT', $2, $3, $4, $5, $6, '1', 'Street')`,
    [setup.appId, setup.region, setup.province, setup.city, setup.barangay, setup.postal]);

  // Completing the section with the pair in agreement is the happy path.
  await accepts('completing the address section with a consistent pair',
    `UPDATE kyc_addresses SET completed_at = NOW()
      WHERE application_id = $1 AND kind = 'CURRENT'`, [setup.appId]);

  // Completing it with FALSE and no permanent address must be refused. This needs
  // its own application: the one above now legitimately has a permanent address,
  // so reusing it would test nothing.
  await client.query(
    `INSERT INTO kyc_applications (id, borrower_id, version, status, started_at)
     VALUES ('kycapp-nopermanent', $1, 1, 'IN_PROGRESS', NOW())`,
    [setup.borrower2Id],
  );
  await client.query(
    `INSERT INTO kyc_addresses
       (application_id, kind, region_code, province_code, city_code, barangay_code,
        postal_code, house_number, street, is_same_as_current)
     VALUES ('kycapp-nopermanent', 'CURRENT', $1, $2, $3, $4, $5, '1', 'Street', FALSE)`,
    [setup.region, setup.province, setup.city, setup.barangay, setup.postal],
  );

  await rejects('completing with FALSE and no permanent address',
    `UPDATE kyc_addresses SET completed_at = NOW()
      WHERE application_id = 'kycapp-nopermanent' AND kind = 'CURRENT'`);

  await rejects('completing with TRUE while a permanent address exists',
    `UPDATE kyc_addresses SET is_same_as_current = TRUE
      WHERE application_id = $1 AND kind = 'CURRENT'`, [setup.appId]);

  // Two current addresses for one application.
  await rejects('a second CURRENT address for the same application',
    `INSERT INTO kyc_addresses
       (application_id, kind, region_code, province_code, city_code, barangay_code,
        postal_code, house_number, street)
     VALUES ($1, 'CURRENT', $2, $3, $4, $5, $6, '2', 'Street')`,
    [setup.appId, setup.region, setup.province, setup.city, setup.barangay, setup.postal]);

  // Financial and contact validation.
  await rejects('negative monthly income',
    `INSERT INTO kyc_financial_information
       (application_id, estimated_monthly_income, estimated_monthly_expenses,
        source_of_income, source_of_funds)
     VALUES ($1, -1, 100, 'Employment', 'Employment')`, [setup.appId]);

  await rejects('negative monthly expenses',
    `INSERT INTO kyc_financial_information
       (application_id, estimated_monthly_income, estimated_monthly_expenses,
        source_of_income, source_of_funds)
     VALUES ($1, 1000, -1, 'Employment', 'Employment')`, [setup.appId]);

  await rejects('mobile number not in E.164 form',
    `INSERT INTO kyc_contacts (application_id, mobile_e164)
     VALUES ($1, '09171234567')`, [setup.appId]);

  await accepts('valid E.164 mobile number',
    `INSERT INTO kyc_contacts (application_id, mobile_e164)
     VALUES ($1, '+639171234567')`, [setup.appId]);

  // Status must stay inside the eight legal values.
  await rejects('status outside the eight legal values',
    `UPDATE kyc_applications SET status = 'PENDING' WHERE id = $1`, [setup.appId]);

  await accepts('a legal status transition target',
    `UPDATE kyc_applications SET status = 'SUBMITTED', submitted_at = NOW() WHERE id = $1`,
    [setup.appId]);

  // Documents: a durable path is mandatory, and the type must exist.
  await rejects('document row with a blank storage path',
    `INSERT INTO kyc_documents
       (application_id, borrower_id, document_type_code, storage_path)
     VALUES ($1, $2, 'PROOF_OF_ADDRESS', '   ')`, [setup.appId, setup.borrowerId]);

  await rejects('document type that is not in the catalogue',
    `INSERT INTO kyc_documents
       (application_id, borrower_id, document_type_code, storage_path)
     VALUES ($1, $2, 'NOT_A_REAL_TYPE', 'kyc/x/y.pdf')`, [setup.appId, setup.borrowerId]);

  await accepts('valid document row',
    `INSERT INTO kyc_documents
       (application_id, borrower_id, document_type_code, storage_path, size_bytes, mime_type)
     VALUES ($1, $2, 'PROOF_OF_ADDRESS', 'kyc/x/proof.pdf', 1024, 'application/pdf')`,
    [setup.appId, setup.borrowerId]);

  // One current file per document type.
  await rejects('a second current file for the same document type',
    `INSERT INTO kyc_documents
       (application_id, borrower_id, document_type_code, storage_path)
     VALUES ($1, $2, 'PROOF_OF_ADDRESS', 'kyc/x/proof2.pdf')`,
    [setup.appId, setup.borrowerId]);

  // Status transitions are a directed graph, and the ones that matter most are
  // the ones a client could use to grant themselves an approval.
  await rejects('a new application arriving pre-approved',
    `INSERT INTO kyc_applications (id, borrower_id, version, status)
     VALUES ('kycapp-preapproved', $1, 1, 'APPROVED')`, [setup.borrowerId]);

  await rejects('skipping straight from SUBMITTED to APPROVED',
    `UPDATE kyc_applications SET status = 'APPROVED', reviewed_by = 'r1', reviewed_at = NOW()
      WHERE id = $1`, [setup.appId]);

  // The session role is unset, so these actors are clients.
  await rejects('moving a submission into review as a client',
    `UPDATE kyc_applications SET status = 'UNDER_REVIEW' WHERE id = $1`, [setup.appId]);

  await rejects('APPROVED as a client',
    `UPDATE kyc_applications SET status = 'APPROVED', reviewed_by = 'r1', reviewed_at = NOW()
      WHERE id = $1`, [setup.appId]);

  await client.query("SET app.actor_role = 'ADMINISTRATOR'");
  try {
    await accepts('claiming the file for review',
      `UPDATE kyc_applications SET status = 'UNDER_REVIEW' WHERE id = $1`, [setup.appId]);

    await rejects('approving without recording who approved',
      `UPDATE kyc_applications SET status = 'APPROVED', reviewed_at = NOW() WHERE id = $1`,
      [setup.appId]);

    await accepts('approving as a reviewer with decision rights',
      `UPDATE kyc_applications SET status = 'APPROVED', reviewed_by = 'r1',
              reviewer_name = 'Reviewer', reviewed_at = NOW() WHERE id = $1`, [setup.appId]);

    await rejects('reopening an APPROVED application without suspension',
      `UPDATE kyc_applications SET status = 'IN_PROGRESS' WHERE id = $1`, [setup.appId]);

    // Rejection needs a reason the client can act on. A dedicated application is
    // used because APPROVED cannot legally transition straight to REJECTED, and
    // it is driven through the realistic path a real submission takes.
    await accepts('starting a new application as IN_PROGRESS',
      `INSERT INTO kyc_applications (id, borrower_id, version, status)
       VALUES ('kycapp-reject', $1, 1, 'IN_PROGRESS')`, [setup.borrower3Id]);
    await accepts('the client submitting it',
      `UPDATE kyc_applications SET status = 'SUBMITTED' WHERE id = 'kycapp-reject'`);
    await rejects('rejecting without a reason',
      `UPDATE kyc_applications SET status = 'REJECTED', reviewed_by = 'r1', reviewed_at = NOW()
        WHERE id = 'kycapp-reject'`);
    await accepts('rejecting with a reason',
      `UPDATE kyc_applications SET status = 'REJECTED', reviewed_by = 'r1', reviewed_at = NOW(),
              rejection_reason = 'The uploaded ID was illegible.'
        WHERE id = 'kycapp-reject'`);

    // The denormalised borrower status must follow the application, or the loan
    // gate and the KYC screen disagree about whether this person is verified.
    const synced = await client.query(
      `SELECT kyc_status FROM borrowers WHERE id = $1`, [setup.borrowerId]);
    if (synced.rows[0].kyc_status === 'APPROVED') {
      console.log('  ok    borrower.kyc_status follows the application to APPROVED');
    } else {
      console.log(`  FAIL  borrower.kyc_status is ${synced.rows[0].kyc_status}, expected APPROVED`);
      bad++;
    }

    // A submitted snapshot is frozen.
    await accepts('stamping the submitted snapshot',
      `UPDATE kyc_applications SET submitted_at = NOW(), snapshot = '{"frozen":true}'::jsonb
        WHERE id = $1`, [setup.appId]);
    await rejects('rewriting a submitted snapshot',
      `UPDATE kyc_applications SET snapshot = '{"frozen":false}'::jsonb WHERE id = $1`,
      [setup.appId]);
  } finally {
    await client.query("RESET app.actor_role");
  }

  // The audit trail is append-only.
  const audit = await client.query(
    `INSERT INTO kyc_audit_logs (borrower_id, application_id, action, actor_role)
     VALUES ($1, $2, 'KYC_MIGRATED', 'SYSTEM') RETURNING id`,
    [setup.borrowerId, setup.appId]);
  const auditId = audit.rows[0].id;
  await rejects('updating an audit log row',
    `UPDATE kyc_audit_logs SET reason = 'rewritten' WHERE id = $1`, [auditId]);
  await rejects('deleting an audit log row',
    `DELETE FROM kyc_audit_logs WHERE id = $1`, [auditId]);
  await accepts('appending to the audit log',
    `INSERT INTO kyc_audit_logs (borrower_id, application_id, action, actor_role)
     VALUES ($1, $2, 'SECTION_SAVED', 'CLIENT')`, [setup.borrowerId, setup.appId]);

  // One live application per borrower, but history is allowed to coexist. The
  // application above is now APPROVED, so a second open attempt is legitimate and
  // a second *open* one is not.
  await accepts('a new attempt after the previous one was closed out',
    `INSERT INTO kyc_applications (id, borrower_id, version, status)
     VALUES ('kycapp-v2', $1, 2, 'IN_PROGRESS')`, [setup.borrowerId]);

  await rejects('a second open application for the same borrower',
    `INSERT INTO kyc_applications (id, borrower_id, version, status)
     VALUES ('kycapp-dup', $1, 3, 'IN_PROGRESS')`, [setup.borrowerId]);

  if (bad) {
    console.log(`\n${bad} behavioural case(s) did not reject invalid data.`);
  } else {
    console.log('\nall constraints reject invalid data as intended.');
  }
  return bad;
}

/**
 * Inserts a borrower, an application and enough PSGC geography for the negative
 * cases above. Uses deliberately contradictory pairs (a city in one region with
 * a barangay from another) so a hierarchy check that is missing is visible.
 */
async function seedFixture(client) {
  await client.query(`
    INSERT INTO borrowers
      (id, borrower_number, full_name, id_number, phone, email, date_of_birth,
       gender, civil_status, address, branch_id, employment_status,
       employer_or_business, occupation, monthly_income, monthly_expenses,
       credit_score, credit_tier, kyc_status, member_status, membership_date,
       avatar, joined_date, last_activity_date)
    VALUES
      ('brn-kyc-test', 'T-0001', 'KYC Test', 'T-ID', '+639171234567', 't@example.com',
       '1990-01-01', 'male', 'single', 'addr', 'br-1', 'employed', 'emp', 'job',
       1000, 100, 500, 'A', 'NOT_STARTED', 'active', '2020-01-01',
       '', '2020-01-01', '2020-01-01'),
      ('brn-kyc-test-2', 'T-0002', 'KYC Test Two', 'T-ID-2', '+639171234568', 't2@example.com',
       '1991-02-02', 'female', 'single', 'addr', 'br-1', 'employed', 'emp', 'job',
       1000, 100, 500, 'A', 'NOT_STARTED', 'active', '2020-01-01',
       '', '2020-01-01', '2020-01-01'),
      ('brn-kyc-test-3', 'T-0003', 'KYC Test Three', 'T-ID-3', '+639171234569', 't3@example.com',
       '1992-03-03', 'male', 'married', 'addr', 'br-1', 'employed', 'emp', 'job',
       1000, 100, 500, 'A', 'NOT_STARTED', 'active', '2020-01-01',
       '', '2020-01-01', '2020-01-01')
    ON CONFLICT (id) DO NOTHING;
  `);

  await client.query(`
    INSERT INTO kyc_applications (id, borrower_id, version, status, started_at)
    VALUES ('kycapp-test', 'brn-kyc-test', 1, 'IN_PROGRESS', NOW())
    ON CONFLICT (id) DO NOTHING;
  `);

  // Two independent region/province/city/barangay chains.
  const chains = [
    { region: '01', province: '0123', city: '012301', barangay: '012301001', postal: '1000' },
    { region: '07', province: '0722', city: '072201', barangay: '072201001', postal: '6000' },
  ];

  await client.query(`
    INSERT INTO psgc_regions (code, name) VALUES
      ('01', 'Ilocos'), ('07', 'Central Visayas'), ('13', 'NCR')
    ON CONFLICT (code) DO NOTHING;
    INSERT INTO psgc_provinces (code, region_code, name) VALUES
      ('0123', '01', 'Test Province A'), ('0722', '07', 'Test Province B')
    ON CONFLICT (code) DO NOTHING;
    INSERT INTO psgc_cities (code, region_code, province_code, name) VALUES
      ('012301', '01', '0123', 'Test City A'),
      ('072201', '07', '0722', 'Test City B')
    ON CONFLICT (code) DO NOTHING;
    INSERT INTO psgc_barangays (code, city_code, name) VALUES
      ('012301001', '012301', 'Test Barangay A'),
      ('072201001', '072201', 'Test Barangay B')
    ON CONFLICT (code) DO NOTHING;
    INSERT INTO psgc_postal_codes (postal_code, city_code, barangay_code) VALUES
      ('1000', '012301', '012301001'), ('6000', '072201', '072201001')
    ON CONFLICT DO NOTHING;
  `);

  return {
    borrowerId: 'brn-kyc-test',
    borrower2Id: 'brn-kyc-test-2',
    borrower3Id: 'brn-kyc-test-3',
    appId: 'kycapp-test',
    region: '01', province: '0123', city: '012301', barangay: '012301001', postal: '1000',
    otherRegion: '07', otherProvince: '0722', otherCity: '072201', otherCityBarangay: '072201001',
  };
}

/**
 * Asserts the properties the KYC flow depends on. A migration that applies
 * cleanly but leaves a missing constraint is exactly the failure that would let
 * incomplete KYC through later, so these are checked explicitly.
 */
async function verify(client) {
  const problems = [];

  const check = async (label, sql, expectPass = true) => {
    try {
      const r = await client.query(sql);
      const v = r.rows[0] && Object.values(r.rows[0])[0];
      const ok = expectPass ? v === true || v > 0 : !!v;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${v !== true && v > 0 ? ` (${v})` : ''}`);
      if (!ok) problems.push(label);
    } catch (err) {
      console.log(`  FAIL  ${label} — ${err.message}`);
      problems.push(label);
    }
  };

  // Geography tables exist with the expected shape.
  for (const t of ['psgc_regions', 'psgc_provinces', 'psgc_cities', 'psgc_barangays', 'psgc_postal_codes']) {
    await check(`table ${t} exists`, `SELECT to_regclass('public.${t}') IS NOT NULL`);
  }

  // `kyc_documents` is the one table whose name is shared by both data models, so
  // "it exists" proves nothing -- the legacy shape would satisfy the check above.
  // Identify the normalised table by the columns that make it normalised.
  await check('kyc_documents is the normalised table, not the legacy shape',
    `SELECT count(*) FILTER (WHERE column_name = 'application_id')    = 1
        AND count(*) FILTER (WHERE column_name = 'document_type_code') = 1
        AND count(*) FILTER (WHERE column_name = 'kyc_submission_id')  = 0
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'kyc_documents'`);

  // The legacy table was retired by rename, never dropped: it is the only record
  // of what the old uploads actually were.
  await check('the legacy kyc_documents table was retired, not dropped',
    `SELECT to_regclass('public.kyc_documents_legacy') IS NOT NULL`);

  // Enums created.
  for (const e of ['kyc_status', 'kyc_document_status', 'kyc_verification_result', 'kyc_decision']) {
    await check(`enum ${e} exists`, `SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${e}')`);
  }

  // The 8 specification statuses are the only legal values.
  const statusEnum = await client.query(`
    SELECT count(*)::int AS n FROM pg_enum
     JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'kyc_status'`);
  console.log(`  ${statusEnum.rows[0].n === 8 ? 'ok  ' : 'FAIL'}  kyc_status has exactly 8 values (${statusEnum.rows[0].n})`);
  if (statusEnum.rows[0].n !== 8) problems.push('kyc_status value count');

  // Normalised KYC tables exist.
  for (const t of [
    'kyc_applications', 'kyc_sections', 'kyc_personal', 'kyc_addresses', 'kyc_contacts',
    'kyc_employment', 'kyc_financial_information', 'kyc_identifications', 'kyc_documents',
    'kyc_verifications', 'kyc_verification_challenges', 'kyc_reviews', 'kyc_corrections',
    'kyc_consents', 'kyc_audit_logs', 'kyc_audit_actions', 'kyc_consent_templates',
    'kyc_id_types', 'kyc_document_types', 'kyc_config',
  ]) {
    await check(`table ${t} exists`, `SELECT to_regclass('public.${t}') IS NOT NULL`);
  }

  // The load-bearing constraints must be present, because they are what make
  // §29 true when application code is bypassed.
  const constraints = [
    ['kyc_personal_dob_sane', 'kyc_personal'],
    ['kyc_personal_nationality_other_required', 'kyc_personal'],
    ['kyc_addresses_postal_shape', 'kyc_addresses'],
    ['kyc_financial_income_non_negative', 'kyc_financial_information'],
    ['kyc_financial_expenses_non_negative', 'kyc_financial_information'],
    ['kyc_financial_other_funds_required', 'kyc_financial_information'],
    ['kyc_employment_employer_required', 'kyc_employment'],
    ['kyc_employment_business_required', 'kyc_employment'],
    ['kyc_contacts_mobile_e164', 'kyc_contacts'],
    ['kyc_documents_path_present', 'kyc_documents'],
    ['kyc_audit_logs_action_fk', 'kyc_audit_logs'],
  ];
  for (const [name, table] of constraints) {
    await check(`constraint ${name} on ${table}`,
      `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}')`);
  }

  // Triggers that enforce behaviour application code could otherwise skip.
  for (const [name, table] of [
    ['trg_psgc_cities_region_province', 'psgc_cities'],
    ['trg_kyc_addresses_hierarchy', 'kyc_addresses'],
    ['trg_kyc_addresses_same_flag', 'kyc_addresses'],
    ['trg_kyc_applications_transition', 'kyc_applications'],
    ['trg_kyc_applications_insert', 'kyc_applications'],
    ['trg_kyc_applications_sync_borrower', 'kyc_applications'],
    ['trg_kyc_applications_freeze', 'kyc_applications'],
    // The audit trail must be unalterable, not merely unaltered.
    ['trg_kyc_audit_logs_no_update', 'kyc_audit_logs'],
    ['trg_kyc_audit_logs_no_delete', 'kyc_audit_logs'],
  ]) {
    await check(`trigger ${name} on ${table}`,
      `SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = '${name}')`);
  }

  // The authorisation helpers the RLS policies and the transition guard depend
  // on. A missing function here means the policies silently allow everything.
  for (const fn of ['app_current_borrower_id', 'app_actor_role', 'app_is_staff',
                    'app_may_decide_kyc', 'app_current_staff_branch',
                    'kyc_status_transition_allowed']) {
    await check(`function ${fn} exists`,
      `SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = '${fn}')`);
  }

  // An unset session variable must mean "unprivileged", never "allowed".
  await check('app_may_decide_kyc is false when no role is set',
    `SELECT app_may_decide_kyc() = false`);
  await check('app_is_staff is false when no role is set',
    `SELECT app_is_staff() = false`);

  // RLS is installed but not yet forced; see 0022 section 5. Both facts matter
  // and are easy to confuse, so both are asserted.
  for (const t of ['kyc_applications', 'kyc_documents', 'kyc_reviews',
                   'kyc_audit_logs', 'kyc_corrections', 'kyc_verification_challenges',
                   'psgc_cities', 'psgc_barangays']) {
    await check(`RLS enabled on ${t}`,
      `SELECT relrowsecurity FROM pg_class WHERE relname = '${t}'`);
  }
  await check('kyc_applications RLS not yet forced',
    `SELECT relforcerowsecurity = false FROM pg_class WHERE relname = 'kyc_applications'`);

  for (const [name, table] of [
    ['kyc_applications_owner_read', 'kyc_applications'],
    ['kyc_reviews_staff_only', 'kyc_reviews'],
    ['kyc_challenges_staff_only', 'kyc_verification_challenges'],
    ['kyc_audit_logs_staff_read', 'kyc_audit_logs'],
    ['kyc_documents_owner_read', 'kyc_documents'],
  ]) {
    await check(`policy ${name} on ${table}`,
      `SELECT EXISTS (SELECT 1 FROM pg_policies
                       WHERE policyname = '${name}' AND tablename = '${table}')`);
  }

  // Seeded catalogues are present and non-empty.
  await check('kyc_id_types seeded', 'SELECT count(*) > 0 FROM kyc_id_types');
  await check('kyc_document_types seeded', 'SELECT count(*) > 0 FROM kyc_document_types');
  await check('kyc_consent_templates seeded (5 declarations)', 'SELECT count(*) >= 5 FROM kyc_consent_templates');
  await check('kyc_audit_actions seeded', 'SELECT count(*) > 0 FROM kyc_audit_actions');
  await check('kyc_config seeded', 'SELECT count(*) > 0 FROM kyc_config');

  // Mobile verification must default OFF: no SMS provider is configured, and a
  // completeness check asserting an unperformed verification would be a lie.
  await check('require_mobile_verification defaults to false',
    `SELECT (value = 'false'::jsonb) FROM kyc_config WHERE key = 'require_mobile_verification'`);

  if (problems.length) {
    console.log(`\n${problems.length} invariant(s) failed:\n  - ${problems.join('\n  - ')}`);
  } else {
    console.log('\nall schema invariants hold.');
  }
}

main().catch((err) => {
  console.error(`\nmigration check failed: ${err.message}`);
  process.exit(1);
});
