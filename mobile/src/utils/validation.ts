export interface FieldError {
  field: string;
  message: string;
}

export const validators = {
  required(value: any, label = 'This field'): string | null {
    if (value === undefined || value === null || String(value).trim() === '') {
      return `${label} is required.`;
    }
    return null;
  },

  email(value: string): string | null {
    const v = (value || '').trim();
    if (!v) return 'Email is required.';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(v)) return 'Enter a valid email address.';
    return null;
  },

  phonePolicy(value: string): string | null {
    // Accept +639..., 09..., 639...
    const digits = (value || '').replace(/[^0-9+]/g, '');
    if (!digits) return 'Mobile number is required.';
    const re = /^(\+63|0)?(9\d{9})$/;
    if (!re.test(digits)) return 'Enter a valid PH mobile number (e.g. 0917 555 4321).';
    return null;
  },

  password(value: string, min = 8): string | null {
    if (!value) return 'Password is required.';
    if (value.length < min) return `Password must be at least ${min} characters.`;
    return null;
  },

  confirmPassword(value: string, other: string): string | null {
    if (!value) return 'Please confirm your password.';
    if (value !== other) return 'Passwords do not match.';
    return null;
  },

  amount(value: string, min?: number, max?: number): string | null {
    const num = Number((value || '').replace(/[, ]/g, ''));
    if (isNaN(num) || num <= 0) return 'Enter a valid amount greater than 0.';
    if (min !== undefined && num < min) return `Minimum amount is ₱${min.toLocaleString()}.`;
    if (max !== undefined && num > max) return `Maximum amount is ₱${max.toLocaleString()}.`;
    return null;
  },

  number(value: string, label = 'Value'): string | null {
    const num = Number(value);
    if (isNaN(num)) return `${label} must be a number.`;
    return null;
  },

  numericText(value: string): string | null {
    if (!value) return null;
    const num = Number(value.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return 'Enter a valid number.';
    return null;
  },

  dateOfBirth(value: string): string | null {
    if (!value) return 'Date of birth is required.';
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(value)) return 'Use YYYY-MM-DD format.';
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'Invalid date.';
    const age = (Date.now() - d.getTime()) / (365.25 * 86400000);
    if (age < 18) return 'You must be at least 18 years old.';
    if (age > 120) return 'Please check your date of birth.';
    return null;
  },

  length(value: string, min: number, label = 'This field'): string | null {
    if ((value || '').trim().length < min) return `${label} must be at least ${min} characters.`;
    return null;
  },
};

export function validateFields(rules: Array<{ field: string; error: string | null }>): Array<FieldError> {
  return rules.filter((r) => r.error).map((r) => ({ field: r.field, message: r.error as string }));
}

export function firstError(errors: Array<FieldError>): FieldError | null {
  return errors.length ? errors[0] : null;
}