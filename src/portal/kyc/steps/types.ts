import type { KycFormState } from '../../../../shared/client';
import type { KycStatusData } from '../../types';
import type { WizardStepKey } from '../wizard';

export type FormErrors = Partial<Record<keyof KycFormState, string>>;

/** What every step receives from the wizard. */
export interface StepProps {
  form: KycFormState;
  update: (patch: Partial<KycFormState>) => void;
  /** Field errors, shown once the member has tried to continue. */
  errors: FormErrors;
  status: KycStatusData;
  /** Sections staff asked to change, or null when everything may change. */
  requested: string[] | null;
  /** Nothing in this step may change now (changes were requested elsewhere). */
  locked: boolean;
  today: string;
  /** Saves the form; false when the server refused (the wizard shows why). */
  save: () => Promise<boolean>;
  /** Reloads the status after an upload or a check; null when it could not be loaded. */
  refresh: () => Promise<KycStatusData | null>;
  goTo: (key: WizardStepKey) => void;
}
