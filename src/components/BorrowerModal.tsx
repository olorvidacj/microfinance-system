import React, { useState } from 'react';
import { X, UserPlus, Save, Building2 } from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { Borrower } from '../types';

interface BorrowerModalProps {
  isOpen: boolean;
  onClose: () => void;
  editBorrower?: Borrower | null;
}

export const BorrowerModal: React.FC<BorrowerModalProps> = ({
  isOpen,
  onClose,
  editBorrower,
}) => {
  const { branches, createBorrower, updateBorrower } = useLoan();

  const [fullName, setFullName] = useState(editBorrower?.fullName || '');
  const [email, setEmail] = useState(editBorrower?.email || '');
  const [phone, setPhone] = useState(editBorrower?.phone || '');
  const [idNumber, setIdNumber] = useState(editBorrower?.idNumber || '');
  const [branchId, setBranchId] = useState(editBorrower?.branchId || branches[0]?.id || '');
  const [monthlyIncome, setMonthlyIncome] = useState(editBorrower?.monthlyIncome || 4500);
  const [creditScore, setCreditScore] = useState(editBorrower?.creditScore || 680);
  const [occupation, setOccupation] = useState(editBorrower?.occupation || 'Small Business Owner');
  const [employer, setEmployer] = useState(editBorrower?.employer || 'Self-Employed Retail');
  const [employmentStatus, setEmploymentStatus] = useState<any>(
    editBorrower?.employmentStatus || 'Self-Employed'
  );
  const [address, setAddress] = useState(editBorrower?.address || '452 Marketplace St');
  const [city, setCity] = useState(editBorrower?.city || 'Metropolis');
  const [kycStatus, setKycStatus] = useState<any>(editBorrower?.kycStatus || 'VERIFIED');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone) return;

    if (editBorrower) {
      updateBorrower(editBorrower.id, {
        fullName,
        email,
        phone,
        idNumber,
        branchId,
        monthlyIncome: Number(monthlyIncome),
        creditScore: Number(creditScore),
        occupation,
        employer,
        employerOrBusiness: employer,
        employmentStatus,
        address,
        kycStatus,
      });
    } else {
      createBorrower({
        fullName,
        email,
        phone,
        idNumber,
        branchId,
        monthlyIncome: Number(monthlyIncome),
        creditScore: Number(creditScore),
        occupation,
        employer,
        employerOrBusiness: employer,
        employmentStatus,
        address,
        kycStatus,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8 shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              {editBorrower ? 'Update Borrower Account' : 'Register New Borrower'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Full Legal Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Maria Gonzalez"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">National ID / Passport # *</label>
              <input
                type="text"
                required
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="e.g. ID-8849201"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maria@example.com"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Home Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Monthly Income ($)</label>
              <input
                type="number"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Credit Score (300-850)</label>
              <input
                type="number"
                value={creditScore}
                onChange={(e) => setCreditScore(Number(e.target.value))}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Occupation</label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="e.g. Retail Store Owner, Engineer"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Employment Type</label>
              <select
                value={employmentStatus}
                onChange={(e: any) => setEmploymentStatus(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <option value="Employed">Employed (Salaried)</option>
                <option value="Self-Employed">Self-Employed (Business)</option>
                <option value="Business Owner">Business Owner</option>
                <option value="Contractor">Contractor / Freelancer</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Residential Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">KYC Verification Status</label>
              <select
                value={kycStatus}
                onChange={(e: any) => setKycStatus(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <option value="VERIFIED">Verified (Documents Checked)</option>
                <option value="PENDING">Pending Review</option>
                <option value="NOT_STARTED">Incomplete</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2 px-5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{editBorrower ? 'Save Changes' : 'Register Borrower'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
