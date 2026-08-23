import { z } from 'zod';
import { STAFF_ROLES } from '../utils/constants.js';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

const email = z.string().trim().toLowerCase().email('A valid email is required');

export const clientSignupSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email,
    password,
    phone: z
      .string()
      .trim()
      .regex(/^(\+63|0)9\d{9}$/, 'Use a Philippine mobile number, e.g. 09171234567')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    clientCode: z
      .string()
      .trim()
      .regex(/^CL-\d{4}-\d{5}$/, 'Client code format is CL-YYYY-NNNNN')
      .optional(),
  })
  .strict();

export const loginSchema = z.object({
  email,
  password: z.string().min(1),
});

export const staffCreateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email,
    password,
    role: z.enum(STAFF_ROLES),
  })
  .strict();

export const statusUpdateSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const uuidParamSchema = z.object({
  userId: z.string().uuid(),
});
