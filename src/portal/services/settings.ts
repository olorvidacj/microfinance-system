import { clientRequest } from './clientApi';

export interface SignIn {
  id: string;
  /** ISO timestamp of the sign-in. */
  time: string;
}

export const settingsService = {
  /** The member's last sign-ins, newest first (from the audit log). */
  async signIns(): Promise<SignIn[]> {
    return (await clientRequest('/api/client/settings/sessions'))?.sessions || [];
  },
};
