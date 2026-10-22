import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '../db/schema';
import { createLocalDatabase, localDrizzle } from '../db/testing/localDatabase';
import { HttpError, type AppDb } from '../kyc/errors';
import { hashPassword, verifyPassword } from './index';
import { changePassword } from './passwords';

let pg: PGlite;
let db: AppDb;

async function expectHttp(p: Promise<unknown>, status: number, code: string) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(status);
    expect((e as HttpError).code).toBe(code);
    return e as HttpError;
  }
  throw new Error(`expected ${status} ${code}`);
}

beforeAll(async () => {
  pg = await createLocalDatabase();
  db = localDrizzle(pg) as unknown as AppDb;
  await db.insert(schema.users).values({ id: 'u-1', email: 'maria@example.test', passwordHash: hashPassword('Secret#2026x'), fullName: 'Maria', role: 'CLIENT' });
}, 120_000);

afterAll(async () => {
  await pg?.close();
});

const hashOf = async () => (await db.select().from(schema.users).where(eq(schema.users.id, 'u-1')))[0].passwordHash;

describe('changing a password', () => {
  it('needs the current password and a strong, different new one', async () => {
    const weak = await expectHttp(changePassword(db, 'u-1', { currentPassword: 'Secret#2026x', newPassword: 'password' }), 400, 'INVALID_PASSWORD');
    expect((weak.details as any).fields.newPassword).toMatch(/strong password/);
    await expectHttp(changePassword(db, 'u-1', { currentPassword: 'Secret#2026x', newPassword: 'Secret#2026x' }), 400, 'INVALID_PASSWORD');
    await expectHttp(changePassword(db, 'u-1', { currentPassword: '', newPassword: 'Better#2027y' }), 400, 'INVALID_PASSWORD');
    const wrong = await expectHttp(changePassword(db, 'u-1', { currentPassword: 'Guess#1234a', newPassword: 'Better#2027y' }), 400, 'WRONG_PASSWORD');
    expect((wrong.details as any).fields.currentPassword).toBeTruthy();
    expect(verifyPassword('Secret#2026x', await hashOf())).toBe(true);
  });

  it('replaces the password: the new one works, the old one no longer does', async () => {
    await changePassword(db, 'u-1', { currentPassword: 'Secret#2026x', newPassword: 'Better#2027y' });
    const hash = await hashOf();
    expect(verifyPassword('Better#2027y', hash)).toBe(true);
    expect(verifyPassword('Secret#2026x', hash)).toBe(false);
  });

  it('an unknown user is refused', async () => {
    await expectHttp(changePassword(db, 'u-nobody', { currentPassword: 'Better#2027y', newPassword: 'Other#2028z' }), 401, 'UNAUTHENTICATED');
  });
});
