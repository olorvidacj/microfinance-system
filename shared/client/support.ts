/**
 * Member messages to their branch: the categories and the checks used by the
 * web portal, the mobile app and the server (src/client/support.ts).
 */
export const SUPPORT_CATEGORIES = ['Loans', 'Payments', 'Savings', 'Groups', 'KYC', 'Account', 'Other'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_SUBJECT_MAX = 120;
export const SUPPORT_MESSAGE_MAX = 2000;

export interface SupportRequestInput {
  subject: string;
  category: SupportCategory;
  message: string;
}

export function validateSupportRequest(input: { subject?: unknown; category?: unknown; message?: unknown }): {
  ok: boolean;
  value: SupportRequestInput;
  errors: Record<string, string>;
} {
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  const category = (SUPPORT_CATEGORIES as readonly string[]).includes(String(input.category)) ? (String(input.category) as SupportCategory) : 'Other';
  const errors: Record<string, string> = {};
  if (subject.length < 3) errors.subject = 'Give your message a short subject.';
  else if (subject.length > SUPPORT_SUBJECT_MAX) errors.subject = `Keep the subject under ${SUPPORT_SUBJECT_MAX} characters.`;
  if (message.length < 10) errors.message = 'Tell us a bit more (at least 10 characters).';
  else if (message.length > SUPPORT_MESSAGE_MAX) errors.message = `Keep the message under ${SUPPORT_MESSAGE_MAX} characters.`;
  return { ok: Object.keys(errors).length === 0, value: { subject, category, message }, errors };
}
