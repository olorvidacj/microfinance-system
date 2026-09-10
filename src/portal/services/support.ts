import { withMockFallback } from './clientApi';
import { FaqItem, SupportTicket } from '../types';
import { mockFaqs, mockTickets } from './mock';

export const supportService = {
  async faqs(): Promise<{ categories: string[]; byCategory: Record<string, FaqItem[]> }> {
    return withMockFallback(
      async () => {
        const categories = Object.keys(mockFaqs);
        const byCategory = mockFaqs;
        return { categories, byCategory };
      },
      async () => ({ categories: Object.keys(mockFaqs), byCategory: mockFaqs })
    );
  },

  async tickets(): Promise<SupportTicket[]> {
    return withMockFallback(async () => mockTickets, async () => mockTickets);
  },

  async submit(input: { subject: string; category: string; message: string }): Promise<SupportTicket> {
    return withMockFallback(
      async () => {
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
      async () => ({
        id: `TKT-2026-${String(Math.floor(Math.random() * 900) + 100)}`,
        subject: input.subject,
        category: input.category,
        message: input.message,
        createdAt: new Date().toISOString().split('T')[0],
        status: 'OPEN',
        lastUpdate: new Date().toISOString().split('T')[0],
      })
    );
  },
};