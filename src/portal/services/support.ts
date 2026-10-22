import { ApiError, clientRequest } from './clientApi';
import type { FaqView, SupportContactView, SupportRequestInput, SupportRequestView } from '../../../shared/client';

export const supportService = {
  async faqs(): Promise<{ categories: string[]; byCategory: Record<string, FaqView[]> }> {
    const faqs: FaqView[] = await clientRequest('/api/client/support/faqs', undefined, (p) => p?.faqs);
    if (!Array.isArray(faqs)) throw new ApiError('Help articles could not be loaded.');
    const byCategory: Record<string, FaqView[]> = {};
    for (const faq of faqs) (byCategory[faq.category] ||= []).push(faq);
    return { categories: Object.keys(byCategory), byCategory };
  },

  async contact(): Promise<SupportContactView> {
    const contact: SupportContactView | undefined = await clientRequest('/api/client/support/contact', undefined, (p) => p?.contact);
    if (!contact) throw new ApiError('Your branch details could not be loaded.');
    return contact;
  },

  async tickets(): Promise<SupportRequestView[]> {
    const tickets: SupportRequestView[] | undefined = await clientRequest('/api/client/support/tickets', undefined, (p) => p?.tickets);
    if (!Array.isArray(tickets)) throw new ApiError('Your messages could not be loaded.');
    return tickets;
  },

  async submit(input: SupportRequestInput): Promise<SupportRequestView> {
    const ticket: SupportRequestView | undefined = await clientRequest('/api/client/support/submit', { method: 'POST', body: JSON.stringify(input) }, (p) => p?.ticket);
    if (!ticket) throw new ApiError('Your message could not be sent.');
    return ticket;
  },
};
