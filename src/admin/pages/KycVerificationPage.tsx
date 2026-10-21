import React, { useMemo } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { adminApi } from '../services/adminApi';
import { KycQueueView } from '../../components/kyc/KycQueueView';
import { useAuth } from '../../context/AuthContext';
import { getRolePermissions, normalizeRole } from '../../auth/permissions';

/** Head-office KYC queue across all branches; the API requires view_all_records, and manage_kyc to decide. */
export const KycVerificationPage: React.FC = () => {
  const { user } = useAuth();
  const canDecide = useMemo(() => {
    const perms = user?.staffRole ? getRolePermissions(normalizeRole(user.staffRole)) : [];
    return perms.includes('view_all_records') && perms.includes('manage_kyc');
  }, [user?.staffRole]);

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'KYC Verification' }]} />
      <KycQueueView
        title="KYC verification — all branches"
        subtitle="Every member's identity application. Decisions require a reason, notify the member and are recorded in the KYC audit log."
        load={adminApi.kycQueue}
        api={adminApi.kyc}
        canDecide={canDecide}
        showBranch
      />
    </div>
  );
};

export default KycVerificationPage;
