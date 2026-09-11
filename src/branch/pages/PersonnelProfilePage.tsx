import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, History, Mail, MapPin, Phone, ShieldCheck, UserCircle2 } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { InfoRow } from '../../portal/components/common';
import { useBranchContext } from '../context/BranchContext';

const PersonnelProfilePage: React.FC = () => {
  const { personnel, ctx, permissions } = useBranchContext();
  const branch = ctx?.branch || null;

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" subtitle="Branch personnel information and permissions" />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="flex flex-col items-center px-5 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-lg font-bold text-white">
              {(personnel.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">{personnel.name}</h3>
            <StatusBadge status={personnel.role} tone="teal" />
            <p className="mt-1 text-xs text-slate-400">{personnel.title}</p>
            {personnel.accountStatus && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" /> {personnel.accountStatus}
              </span>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCircle2 className="h-4 w-4" /> Details</CardTitle>
          </CardHeader>
          <CardBody>
            <InfoRow label="Email" value={<span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {personnel.email}</span>} />
            <InfoRow label="Staff ID" value={personnel.staffId || '—'} />
            <InfoRow label="Role" value={personnel.role} />
            <InfoRow label="Title" value={personnel.title} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Assigns</CardTitle>
          </CardHeader>
          <CardBody>
            {branch ? (
              <>
                <InfoRow label="Branch" value={branch.name} />
                {branch.code && <InfoRow label="Code" value={branch.code} />}
                {branch.address && <InfoRow label="Address" value={<span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {branch.address}</span>} />}
                {branch.contactPhone && <InfoRow label="Phone" value={<span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {branch.contactPhone}</span>} />}
              </>
            ) : (
              <p className="text-sm text-slate-500">No branch assignment (global access).</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Permissions ({permissions.length})</CardTitle>
          <Link to="/staff/app/activity" className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900">
            <History className="h-3.5 w-3.5" /> View activity log
          </Link>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {permissions.map((p) => (
              <span key={p} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                {p}
              </span>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default PersonnelProfilePage;