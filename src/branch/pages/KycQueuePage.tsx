import React from 'react';
import { KycQueueView } from '../../components/kyc/KycQueueView';
import { kycService } from '../services';
import { useBranchPermission } from '../hooks/useBranchPermission';

const MANAGE_KYC = ['manage_kyc'];

/** Branch KYC queue: this branch's members only (enforced by the API). */
export const KycQueuePage: React.FC = () => {
  const canDecide = useBranchPermission(MANAGE_KYC);
  return (
    <KycQueueView
      title="KYC verification"
      subtitle="Review identity applications from members of this branch. Every decision needs a reason and is recorded."
      load={kycService.queue}
      api={kycService}
      canDecide={canDecide}
    />
  );
};

export default KycQueuePage;
