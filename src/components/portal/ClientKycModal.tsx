import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  UploadCloud,
  FileCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileText,
  Lock,
} from 'lucide-react';
import { Borrower, KycDocumentType } from '../../types';
import { formatDate } from '../../utils/loanMath';

interface ClientKycModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Borrower;
  onUploadDocument: (doc: {
    docType: KycDocumentType;
    fileName: string;
    fileSize?: string;
    notes?: string;
  }) => void;
}

const KYC_DOC_TYPES: KycDocumentType[] = [
  'Government ID (Primary)',
  'Government ID (Secondary)',
  'Proof of Income / Payslip / ITR',
  'Business Permit / DTI',
  'Proof of Billing / Residence',
  '2x2 ID Photo',
  'Barangay Clearance',
  'Signature Specimen',
];

export const ClientKycModal: React.FC<ClientKycModalProps> = ({
  isOpen,
  onClose,
  member,
  onUploadDocument,
}) => {
  const [docType, setDocType] = useState<KycDocumentType>('Government ID (Primary)');
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;

    setIsUploading(true);
    setTimeout(() => {
      onUploadDocument({
        docType,
        fileName: fileName.trim(),
        fileSize: `${(Math.random() * 2 + 0.8).toFixed(1)} MB`,
        notes: notes.trim() || undefined,
      });
      setIsUploading(false);
      setSuccessMsg(`"${fileName}" uploaded successfully and queued for Officer Verification!`);
      setFileName('');
      setNotes('');
      setTimeout(() => setSuccessMsg(''), 4000);
    }, 600);
  };

  const handleSimulateFilePick = (type: KycDocumentType) => {
    setDocType(type);
    const sampleNames: Record<string, string> = {
      'Government ID (Primary)': `PH_National_ID_${member.fullName.replace(/\s+/g, '_')}.jpg`,
      'Government ID (Secondary)': `UMID_Card_${member.fullName.replace(/\s+/g, '_')}.pdf`,
      'Proof of Income / Payslip / ITR': `Income_Payslip_Aug2026.pdf`,
      'Business Permit / DTI': `DTI_Business_Registration.pdf`,
      'Proof of Billing / Residence': `Electric_Bill_Leyeco_Aug2026.pdf`,
      '2x2 ID Photo': `Photo_2x2_WhiteBg.jpg`,
      'Barangay Clearance': `Barangay_Clearance_2026.pdf`,
      'Signature Specimen': `Signature_Specimen_Card.png`,
    };
    setFileName(sampleNames[type] || `Doc_${type.replace(/\s+/g, '_')}.pdf`);
  };

  const uploadedDocs = member.kycDocuments || [];
  const isFullyVerified = member.kycStatus === 'VERIFIED';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">KYC Verification & Document Vault</h3>
              <p className="text-xs text-slate-400">Cooperative Identity & Compliance Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* KYC Status Overview */}
          <div className="p-4 rounded-2xl border bg-slate-50 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Verification Tier
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-bold text-slate-900">
                  Tier {member.creditTier || '2'} — {isFullyVerified ? 'Full Member Verified' : 'Basic Verified'}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    member.kycStatus === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : member.kycStatus === 'CORRECTION_REQUIRED'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}
                >
                  {member.kycStatus || 'VERIFIED'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Member ID: <span className="font-mono font-semibold text-slate-700">{member.borrowerNumber}</span> •
                Last Reviewed: {member.kycReviewedAt ? formatDate(member.kycReviewedAt) : 'Aug 2026'}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-500 block">Verified Documents</span>
              <span className="text-xl font-bold text-teal-700">
                {uploadedDocs.filter((d) => d.status === 'VERIFIED').length} / {uploadedDocs.length || 3}
              </span>
            </div>
          </div>

          {/* Success message */}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Upload Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                Upload New Identification Document
              </h4>
              <span className="text-[11px] text-slate-500">JPG, PNG, PDF max 10MB</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Document Category</label>
                  <select
                    value={docType}
                    onChange={(e) => {
                      const t = e.target.value as KycDocumentType;
                      handleSimulateFilePick(t);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {KYC_DOC_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">File Name / Attachment</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g. National_ID_Front.jpg"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSimulateFilePick(docType)}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl shrink-0"
                    >
                      Pick Sample
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Remarks / Document Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Card No. 1234-5678-9012, Valid until 2030"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isUploading || !fileName.trim()}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Encrypting & Uploading to Compliance Vault...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Submit Document for Verification</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Uploaded Documents List */}
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
              <span>Your Vault Documents</span>
              <span className="text-xs text-slate-500 font-normal">Encrypted & securely stored</span>
            </h4>

            {uploadedDocs.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-200 rounded-2xl text-slate-500 text-xs">
                No KYC documents uploaded yet. Use the form above to attach your primary government ID.
              </div>
            ) : (
              <div className="space-y-2.5">
                {uploadedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{doc.docType}</div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {doc.fileName} {doc.fileSize ? `(${doc.fileSize})` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 ${
                          doc.status === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : doc.status === 'CORRECTION_REQUIRED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {doc.status === 'VERIFIED' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {doc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition"
          >
            Close Vault
          </button>
        </div>
      </div>
    </div>
  );
};
