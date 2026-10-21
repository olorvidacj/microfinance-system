import { describe, expect, it } from 'vitest';
import { evaluatePassword, isPasswordStrong } from './password';

describe('password strength', () => {
  it('scores the five rules and needs all of them to be strong', () => {
    expect(evaluatePassword('')).toMatchObject({ level: 'empty', score: 0, isStrong: false });
    expect(evaluatePassword('abc')).toMatchObject({ level: 'weak', isStrong: false });
    expect(evaluatePassword('abcdefgh1')).toMatchObject({ level: 'medium', score: 3 });
    expect(evaluatePassword('Abcdefg1')).toMatchObject({ level: 'medium', score: 4, isStrong: false });
    expect(evaluatePassword('Abcdefg1!')).toMatchObject({ level: 'strong', score: 5, percentage: 100, isStrong: true });
    expect(evaluatePassword('Ab1!').criteria).toEqual({ minLength: false, hasUpper: true, hasLower: true, hasNumber: true, hasSpecial: true });
    expect(isPasswordStrong('Secret#2026x')).toBe(true);
  });
});
