import { describe, expect, it } from 'vitest';
import { authStore, hashPassword, verifyPassword } from './index';
import { INITIAL_STAFF } from '../data/initialData';

describe('password verification', () => {
  it('accepts the right password and rejects the wrong one', () => {
    const stored = hashPassword('Correct#Horse1');
    expect(verifyPassword('Correct#Horse1', stored)).toBe(true);
    expect(verifyPassword('wrong', stored)).toBe(false);
  });

  it('never accepts the stored value itself as a password', () => {
    const stored = hashPassword('Correct#Horse1');
    expect(verifyPassword(stored, stored)).toBe(false);
    expect(verifyPassword('plaintext', 'plaintext')).toBe(false);
  });
});

describe('built-in accounts', () => {
  it('no seeded staff email resolves to a login without a database row', async () => {
    // Tests run with no database configured, so only built-in accounts could answer.
    for (const s of INITIAL_STAFF) {
      expect(await authStore.findByEmailOrPhone(s.email)).toBeNull();
    }
    expect(await authStore.findByEmailOrPhone('admin@HOSCOMCO.coop')).toBeNull();
    expect(await authStore.findByEmailOrPhone('09175550100')).toBeNull();
  });
});
