import { FaqItem, SupportTicket } from '../types';

export const supportService = {
  async faqs(): Promise<{ categories: string[]; byCategory: Record<string, FaqItem[]> }> {
    return { categories: [], byCategory: {} };
  },

  async tickets(): Promise<SupportTicket[]> {
    return [];
  },

  async submit(input: { subject: string; category: string; message: string }): Promise<SupportTicket> {
    const ticket: SupportTicket = {
      id: `TKT-2026-${String(Math.floor(Math.random() * 900) + 100)}`,
      subject: input.subject,
      category: input.category,
      message: input.message,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'OPEN',
      lastUpdate: new Date().toISOString().split('T')[0],
    };
    return ticket;
  },
};
