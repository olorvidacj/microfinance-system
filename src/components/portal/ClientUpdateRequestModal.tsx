import React, { useState } from 'react';
import {
  X,
  UserCheck,
  Send,
  Building2,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Borrower, MemberUpdateRequest } from '../../types';

interface ClientUpdateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Borrower;
  onSubmitUpdateRequest: (req: Partial<MemberUpdateRequest>) => void;
}

export const ClientUpdateRequestModal: React.FC<ClientUpdateRequestModalProps> = ({
  isOpen,
  onClose,
  member,
  onSubmitUpdateRequest,
}) => {
  const [fieldToUpdate, setFieldToUpdate] = useState<MemberUpdateRequest['fieldToUpdate']>('Contact Number');
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');
  const [supportingDocType, setSupportingDocType] = useState<MemberUpdateRequest['supportingDocType']>('Valid ID');
  const [supportingDocFileName, setSupportingDocFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const getOldValue = () => {
    switch (fieldToUpdate) {
      case 'Contact Number':
        return member.phone || '';
      case 'Address':
        return member.address || '';
      case 'Civil Status':
        return member.civilStatus || '';
      case 'Employment':
        return `${member.occupation || ''} at ${member.employerOrBusiness || ''}`;
      case 'Beneficiary':
        return member.emergencyContactName ? `${member.emergencyContactName} (${member.emergencyContactRelation || ''})` : 'None specified';
      default:
        return '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim() || !reason.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      onSubmitUpdateRequest({
        memberId: member.id,
        memberName: member.fullName,
        memberNumber: member.borrowerNumber,
        branchId: member.branchId,
        channel: 'Mobile Phone',
        fieldToUpdate,
        oldValue: getOldValue(),
        newValue: newValue.trim(),
        reason: reason.trim(),
        supportingDocType,
        supportingDocFileName: supportingDocFileName.trim() || `${fieldToUpdate.replace(/\s+/g, '_')}_Supporting_Doc.pdf`,
        supportingDocVerified: false,
        status: 'Pending',
      });
      setIsSubmitting(false);
      setSuccessMessage('Your profile update request has been transmitted to HOSCOMO Member Records for verification.');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 2500);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full my-8 shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Request Profile Update</h3>
              <p className="text-xs text-slate-400">Official Membership Record Modification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {successMessage ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 space-y-2 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="font-bold text-sm">Update Request Submitted!</div>
              <p className="text-xs">{successMessage}</p>
            </div>
          ) : (
            <>
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-blue-900 text-[11px] leading-relaxed">
                Cooperative regulations require records officer verification for changes in contact, residential address, or civil status.
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Information Field to Update</label>
                <select
                  value={fieldToUpdate}
                  onChange={(e) => {
                    setFieldToUpdate(e.target.value as MemberUpdateRequest['fieldToUpdate']);
                    setNewValue('');
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Contact Number">Contact Phone Number</option>
                  <option value="Address">Residential Address</option>
                  <option value="Civil Status">Civil Status</option>
                  <option value="Employment">Employment / Business Details</option>
                  <option value="Beneficiary">Emergency Contact / Beneficiary</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  Current Value on Record
                </span>
                <span className="font-mono text-slate-800 font-medium text-xs break-all">
                  {getOldValue() || '(Not provided)'}
                </span>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Requested New Value</label>
                <input
                  type="text"
                  required
                  placeholder={`Enter updated ${fieldToUpdate.toLowerCase()}`}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Reason for Modification</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Relocated to new house / Changed primary SIM card"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Supporting Document</label>
                  <select
                    value={supportingDocType}
                    onChange={(e) => setSupportingDocType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Valid ID">Valid Government ID</option>
                    <option value="Barangay Certificate">Barangay Certificate</option>
                    <option value="Proof of Billing">Proof of Billing</option>
                    <option value="Marriage Contract">Marriage Contract</option>
                    <option value="Other">Other Document</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Attached Document Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. Barangay_Cert_2026.pdf"
                    value={supportingDocFileName}
                    onChange={(e) => setSupportingDocFileName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 font-semibold text-slate-700 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newValue.trim() || !reason.trim()}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Update Request</span>
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
