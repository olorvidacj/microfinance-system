/**
 * Password strength rules shared by the server (registration, reset, change),
 * the web portal and the mobile app: at least 8 characters with an uppercase
 * letter, a lowercase letter, a number and a special character.
 */
export interface PasswordCriteria {
  minLength: boolean;    // >= 8
  hasUpper: boolean;     // [A-Z]
  hasLower: boolean;     // [a-z]
  hasNumber: boolean;    // [0-9]
  hasSpecial: boolean;   // [!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]
}

export type PasswordStrengthLevel = 'empty' | 'weak' | 'medium' | 'strong';

export interface PasswordStrengthResult {
  criteria: PasswordCriteria;
  score: number; // 0 to 5
  percentage: number; // 0 to 100
  level: PasswordStrengthLevel;
  label: string;
  color: string;
  isStrong: boolean;
}

export const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function evaluatePassword(password: string): PasswordStrengthResult {
  const pwd = password || '';
  const criteria: PasswordCriteria = {
    minLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSpecial: SPECIAL_CHAR_REGEX.test(pwd),
  };

  const score = Object.values(criteria).filter(Boolean).length;
  const percentage = (score / 5) * 100;

  let level: PasswordStrengthLevel = 'empty';
  let label = '';
  let color = '#94a3b8'; // Slate 400

  if (pwd.length === 0) {
    level = 'empty';
    label = '';
    color = '#cbd5e1';
  } else if (score < 3) {
    level = 'weak';
    label = 'Weak password';
    color = '#ef4444'; // Red-500
  } else if (score < 5) {
    level = 'medium';
    label = 'Medium password';
    color = '#f59e0b'; // Amber-500
  } else {
    level = 'strong';
    label = 'Strong password';
    color = '#10b981'; // Emerald-500
  }

  return {
    criteria,
    score,
    percentage,
    level,
    label,
    color,
    isStrong: score === 5,
  };
}

export function isPasswordStrong(password: string): boolean {
  return evaluatePassword(password).isStrong;
}

export const STRONG_PASSWORD_ERROR_MESSAGE =
  'Please create a strong password containing at least 8 characters, an uppercase letter, a lowercase letter, a number, and a special character.';
