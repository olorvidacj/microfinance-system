import React from 'react';
import {
  ArrowLeft,
  UserCog,
  Mail,
  Phone,
  Building2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  KeyRound,
  Award,
  Users2,
  Lock,
  Calendar,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { useAccess } from '../hooks/useAccess';
import {
  SystemPermission,
  getRoleDefinition,
  normalizeRole,
} from '../auth/permissions';

export interface StaffRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  assignedBranchId: string;
  avatar: string;
  committee?: string | null;
  isActive: boolean;
  hasAccount?: boolean;
  permissions?: SystemPermission[];
}

interface StaffProfilePageProps {
  staff: StaffRecord;
  onBack: () => void;
}

export const StaffProfilePage: React.FC<StaffProfilePageProps> = ({ staff, onBack }) => {
  const { branches } = useLoan();
  const { permissionCategories } = useAccess();

  const roleKey = normalizeRole(staff.role);
  const roleDef = getRoleDefinition(roleKey);
  const effectivePermissions: SystemPermission[] =
    staff.permissions && staff.permissions.length > 0 ? staff.permissions : roleDef.permissions;

  const branch = staff.assignedBranchId
    ? branches.find((b) => b.id === staff.assignedBranchId) || null
    : null;

  const groupedPermissions = permissionCategories
    .map((cat) => ({
      ...cat,
      matched: cat.permissions.filter((p) => effectivePermissions.includes(p.key)),
    }))
    .filter((cat) => cat.matched.length > 0);

  const statusStyles = staff.isActive
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-rose-100 text-rose-700';

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Staff Management
        </button>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusStyles}`}>
          {staff.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {staff.isActive ? 'Active' : 'Deactivated'}
        </span>
      </div>

      {/* Identity Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
        <div className="px-6 pb-6 -mt-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <img
              src={staff.avatar}
              alt={staff.name}
              className="w-24 h-24 rounded-2xl border-4 border-white object-cover shadow-lg bg-slate-100"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="flex-1 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{staff.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                  {roleDef.name}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{staff.title}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {staff.email}
                </span>
                {staff.committee && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users2 className="w-3.5 h-3.5" /> {staff.committee}
                  </span>
                )}
                {staff.hasAccount && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600">
                    <KeyRound className="w-3.5 h-3.5" /> Login account active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Meta Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" /> Role Key
              </div>
              <div className="text-sm font-semibold text-slate-800 mt-1 font-mono">{roleKey}</div>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                <Building2 className="w-3.5 h-3.5" /> Assigned Branch
              </div>
              <div className="text-sm font-semibold text-slate-800 mt-1">
                {branch ? branch.name : staff.assignedBranchId === 'all' ? 'All Branches' : staff.assignedBranchId || '—'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                <Award className="w-3.5 h-3.5" /> Permissions Granted
              </div>
              <div className="text-sm font-semibold text-slate-800 mt-1">{effectivePermissions.length} capabilities</div>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                <Lock className="w-3.5 h-3.5" /> Account Status
              </div>
              <div className={`text-sm font-semibold mt-1 ${staff.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {staff.isActive ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <UserCog className="w-4 h-4 text-blue-600" /> Role Summary
        </h3>
        <p className="text-sm text-slate-600 mt-2">{roleDef.description}</p>
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 mt-4">
          {roleDef.responsibilities.map((resp, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <span>{resp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-blue-600" /> Permissions Profile
        </h3>
        {groupedPermissions.length === 0 ? (
          <p className="text-sm text-slate-500">No permissions assigned to this role.</p>
        ) : (
          <div className="space-y-5">
            {groupedPermissions.map((cat) => (
              <div key={cat.category}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-2">
                  {cat.category}
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  {cat.matched.map((p) => (
                    <div
                      key={p.key}
                      className="flex items-start gap-2 bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{p.label}</div>
                        <div className="text-xs text-slate-500">{p.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit footer note */}
      <div className="flex items-start gap-2 text-xs text-slate-400 px-2">
        <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Staff role &amp; permission changes are captured in the audit trail by the Roles &amp; Permissions and
          Staff Management modules.
        </span>
      </div>
    </div>
  );
};