import React from 'react';
import { Borrower, Loan } from '../types';
import { ClientProfileModal } from './ClientProfileModal';

interface BorrowerDetailModalProps {
  borrower: Borrower | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectLoan: (loan: Loan) => void;
  onOpenNewLoan: (borrower: Borrower) => void;
  onEditBorrower: (borrower: Borrower) => void;
}

export const BorrowerDetailModal: React.FC<BorrowerDetailModalProps> = ({
  borrower,
  isOpen,
  onClose,
  onSelectLoan,
  onOpenNewLoan,
  onEditBorrower,
}) => {
  return (
    <ClientProfileModal
      client={borrower}
      isOpen={isOpen}
      onClose={onClose}
      onSelectLoan={onSelectLoan}
      onOpenNewLoan={onOpenNewLoan}
      onEditClient={onEditBorrower}
    />
  );
};
