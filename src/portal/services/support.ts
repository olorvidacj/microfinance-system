import { clientRequest } from './clientApi';
import { FaqItem, SupportTicket } from '../types';

export const supportService = {
  async faqs(): Promise<{ categories: string[]; byCategory: Record<string, FaqItem[]> }> {
    const payload = await clientRequest('/api/client/support/faqs');
    const faqs: FaqItem[] = Array.isArray(payload?.faqs) ? payload.faqs : [];
    if (faqs.length === 0) return { categories: [], byCategory: {} };

    const byCategory: Record<string, FaqItem[]> = {};
    for (const faq of faqs) {
      const bucket = (faq as FaqItem & { category?: string }).category || 'General';
      (byCategory[bucket] ||= []).push(faq);
    }
    return { categories: Object.keys(byCategory), byCategory };
  },

  async tickets(): Promise<SupportTicket[]> {
    const payload = await clientRequest('/api/client/support/tickets');
    return payload?.tickets || payload || [];
  },

  async submit(input: { subject: string; category: string; message: string }): Promise<SupportTicket> {
    const payload = await clientRequest('/api/client/support/submit', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload?.ticket || payload;
  },
};
