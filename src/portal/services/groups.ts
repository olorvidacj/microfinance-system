import { clientRequest } from './clientApi';

/** The member's group as the server sends it (src/groups/service.ts myGroup). */
export type MyGroup = NonNullable<Awaited<ReturnType<typeof import('../../groups/service').myGroup>>>;

export const groupService = {
  async myGroup(): Promise<MyGroup | null> {
    return (await clientRequest('/api/client/groups/my'))?.group ?? null;
  },

  /** Consent to (or decline) another member's group loan; the reply is the refreshed group. */
  async consent(loanId: string, decision: 'CONSENT' | 'DECLINE', note?: string): Promise<MyGroup | null> {
    return (await clientRequest(`/api/client/groups/loans/${encodeURIComponent(loanId)}/consent`, { method: 'POST', body: JSON.stringify({ decision, note }) }))?.group ?? null;
  },
};
