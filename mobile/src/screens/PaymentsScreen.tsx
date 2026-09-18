import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { api } from '../services/api';
import { PaymentItem, LoanItem } from '../types';

export const PaymentsScreen: React.FC = () => {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields for Submit Payment Proof
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [amount, setAmount] = useState('4850');
  const [paymentMethod, setPaymentMethod] = useState<'GCASH' | 'MAYA' | 'BANK_TRANSFER' | 'OVER_THE_COUNTER'>('GCASH');
  const [referenceNumber, setReferenceNumber] = useState('GCASH-98214981');
  const [receiptProofUrl, setReceiptProofUrl] = useState('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=300');
  const [notes, setNotes] = useState('Monthly amortization installment');

  const fetchData = async () => {
    try {
      const [payList, loanData] = await Promise.all([
        api.getPayments(),
        api.getLoans(),
      ]);
      setPayments(payList || []);
      setLoans(loanData.activeLoans || []);
      if (loanData.activeLoans && loanData.activeLoans.length > 0) {
        setSelectedLoanId(loanData.activeLoans[0].id);
      }
    } catch (err: any) {
      console.warn('[Payments] fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmitProof = async () => {
    if (!amount || !referenceNumber) {
      Alert.alert('Required Fields', 'Please enter payment amount and reference number.');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitPaymentProof({
        loanId: selectedLoanId,
        amount: Number(amount),
        paymentMethod,
        referenceNumber,
        receiptProofUrl,
        notes,
      });
      Alert.alert('Payment Proof Submitted', 'The Cashier will verify your submission and credit your loan account.');
      setIsSubmitModalOpen(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Submission Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading payment history...</Text>
      </View>
    );
  }

  const formatCurrency = (val: number) => `₱ ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Action Banner */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerTextCol}>
          <Text style={styles.bannerTitle}>Digital Loan Repayment</Text>
          <Text style={styles.bannerSubtitle}>
            Paid via GCash, Maya, or Bank? Upload your receipt slip for instant cashier credit.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.submitProofButton}
          onPress={() => setIsSubmitModalOpen(true)}
        >
          <Text style={styles.submitProofButtonText}>+ Submit Proof</Text>
        </TouchableOpacity>
      </View>

      {/* Payment History List */}
      <Text style={styles.sectionHeader}>Payment Records & Official Receipts</Text>

      {payments.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No payment history found</Text>
          <Text style={styles.emptySubtitle}>Completed loan installments will appear here with official receipt numbers.</Text>
        </View>
      ) : (
        payments.map((p) => (
          <View key={p.id} style={styles.paymentCard}>
            <View style={styles.paymentHeader}>
              <View style={styles.paymentMethodRow}>
                <View style={styles.methodIconBg}>
                  <Text style={{ fontSize: 16 }}>
                    {p.paymentMethod === 'GCASH' ? '📱' : p.paymentMethod === 'MAYA' ? '💳' : '🏦'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.paymentLoanNumber}>{p.loanNumber}</Text>
                  <Text style={styles.paymentDate}>{p.paymentDate} • {p.paymentMethod}</Text>
                </View>
              </View>
              <View style={styles.paymentAmountCol}>
                <Text style={styles.paymentAmount}>{formatCurrency(p.amount)}</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>{p.status}</Text>
                </View>
              </View>
            </View>

            <View style={styles.paymentDivider} />

            <View style={styles.paymentMetaRow}>
              <View>
                <Text style={styles.metaLabel}>Reference Number</Text>
                <Text style={styles.metaValue}>{p.referenceNumber}</Text>
              </View>
              {p.officialReceiptNumber ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metaLabel}>Official Receipt (OR)</Text>
                  <Text style={[styles.metaValue, { color: '#0284C7', fontWeight: '700' }]}>
                    {p.officialReceiptNumber}
                  </Text>
                </View>
              ) : (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metaLabel}>Verification</Text>
                  <Text style={[styles.metaValue, { color: '#D97706' }]}>Pending Approval</Text>
                </View>
              )}
            </View>

            {p.notes ? (
              <Text style={styles.paymentNotes}>📝 {p.notes}</Text>
            ) : null}
          </View>
        ))
      )}

      {/* Submit Payment Proof Modal */}
      <Modal visible={isSubmitModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Payment Proof</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsSubmitModalOpen(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              {/* Select Loan */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Select Loan Facility</Text>
                {loans.map((l) => (
                  <TouchableOpacity
                    key={l.id}
                    style={[
                      styles.loanOption,
                      selectedLoanId === l.id && styles.loanOptionSelected,
                    ]}
                    onPress={() => setSelectedLoanId(l.id)}
                  >
                    <Text style={styles.loanOptionTitle}>
                      {l.loanNumber} — {l.productName}
                    </Text>
                    <Text style={styles.loanOptionSub}>
                      Remaining Bal: ₱{l.remainingBalance?.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Amount */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Repayment Amount (₱)</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="4850"
                />
              </View>

              {/* Payment Method */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Payment Channel</Text>
                <View style={styles.methodGrid}>
                  {(['GCASH', 'MAYA', 'BANK_TRANSFER', 'OVER_THE_COUNTER'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.methodPill,
                        paymentMethod === m && styles.methodPillActive,
                      ]}
                      onPress={() => setPaymentMethod(m)}
                    >
                      <Text
                        style={[
                          styles.methodPillText,
                          paymentMethod === m && styles.methodPillTextActive,
                        ]}
                      >
                        {m.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Reference Number */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Transaction Reference No. / Trace ID</Text>
                <TextInput
                  style={styles.input}
                  value={referenceNumber}
                  onChangeText={setReferenceNumber}
                  placeholder="e.g. 98214981"
                />
              </View>

              {/* Proof Image */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Digital Receipt Screenshot</Text>
                <View style={styles.proofPreview}>
                  <Text style={{ fontSize: 24, marginRight: 10 }}>🧾</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.proofName}>payment_receipt_verified.png</Text>
                    <Text style={styles.proofSub}>Ready to attach</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.attachBtn}
                    onPress={() => Alert.alert('Receipt Attached', 'Sample digital receipt image attached.')}
                  >
                    <Text style={styles.attachBtnText}>Change</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Remarks / Notes (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Installment #7 payment"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryModalButton}
                onPress={handleSubmitProof}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryModalButtonText}>Transmit Proof to Cashier</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  bannerCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTextCol: {
    flex: 1,
    marginRight: 12,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  bannerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  submitProofButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  submitProofButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  paymentLoanNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  paymentDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  paymentAmountCol: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  statusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
  },
  paymentDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  paymentMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 1,
  },
  paymentNotes: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '700',
  },
  modalForm: {
    maxHeight: 500,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  loanOption: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  loanOptionSelected: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  loanOptionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  loanOptionSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  methodPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  methodPillActive: {
    backgroundColor: '#059669',
  },
  methodPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  methodPillTextActive: {
    color: '#FFFFFF',
  },
  proofPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  proofName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  proofSub: {
    fontSize: 10,
    color: '#059669',
  },
  attachBtn: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  attachBtnText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  primaryModalButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 16,
  },
  primaryModalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
