import React from 'react';
import { KycReviewPanel as SharedKycReviewPanel } from '../../components/kyc/KycReviewPanel';
import { kycService } from '../services';
import { useBranchPermission } from '../hooks/useBranchPermission';

const MANAGE_KYC = ['manage_kyc'];

interface KycReviewPanelProps {
  clientId: string | null;
  onClose: () => void;
  onDone?: () => void;
}

/** Branch binding of the shared KYC review panel (branch-scoped endpoints). */
export const KycReviewPanel: React.FC<KycReviewPanelProps> = ({ clientId, onClose, onDone }) => {
  const canDecide = useBranchPermission(MANAGE_KYC);
  if (!clientId) return null;
  return <SharedKycReviewPanel clientId={clientId} api={kycService} canDecide={canDecide} onClose={onClose} onDone={onDone} />;
};

export default KycReviewPanel;
