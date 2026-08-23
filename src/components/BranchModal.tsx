import React, { useState } from 'react';
import { X, Building2, Save } from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { Branch } from '../types';

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  editBranch?: Branch | null;
}

export const BranchModal: React.FC<BranchModalProps> = ({
  isOpen,
  onClose,
  editBranch,
}) => {
  const { addBranch, updateBranch } = useLoan();

  const [name, setName] = useState(editBranch?.name || '');
  const [code, setCode] = useState(editBranch?.code || '');
  const [city, setCity] = useState(editBranch?.city || 'Metropolis');
  const [address, setAddress] = useState(editBranch?.address || '100 Financial Ave');
  const [phone, setPhone] = useState(editBranch?.phone || '+1 (555) 019-2831');
  const [managerName, setManagerName] = useState(editBranch?.managerName || 'Sarah Jenkins');
  const [cashVaultBalance, setCashVaultBalance] = useState(editBranch?.cashVaultBalance || 50000);
  const [color, setColor] = useState(editBranch?.color || '#2563EB');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    if (editBranch) {
      updateBranch(editBranch.id, {
        name,
        code,
        city,
        address,
        phone,
        managerName,
        cashVaultBalance: Number(cashVaultBalance),
        color,
      });
    } else {
      addBranch({
        name,
        code,
        city,
        address,
        phone,
        managerName,
        cashVaultBalance: Number(cashVaultBalance),
        color,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full my-8 shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              {editBranch ? 'Edit Branch Location' : 'Open New Branch Location'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Branch Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Uptown Hub"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Branch Code (3-4 Chars) *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. UPT"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">City / Region</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Physical Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Branch Operations Manager</label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Initial Cash Vault Liquidity ($)</label>
              <input
                type="number"
                value={cashVaultBalance}
                onChange={(e) => setCashVaultBalance(Number(e.target.value))}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs font-bold"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Brand Accent Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-9 p-1 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{editBranch ? 'Update Branch' : 'Add Branch'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
