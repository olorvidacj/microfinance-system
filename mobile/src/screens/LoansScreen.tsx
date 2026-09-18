import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { api } from '../services/api';
import { LoanItem, InstallmentScheduleItem } from '../types';

export const LoansScreen: React.FC = () => {
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [activeLoans, setActiveLoans] = useState<LoanItem[]>([]);
  const [completedLoans, setCompletedLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment Schedule Modal
  const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null);
  const [schedule, setSchedule] = useState<InstallmentScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchLoans = async () => {
    try {
      const data = await api.getLoans();
      setActiveLoans(data.activeLoans || []);
      setCompletedLoans(data.completedLoans || []);
    } catch (err: any) {
      console.warn('[LoansScreen] fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const openScheduleModal = async (loan: LoanItem) => {
    setSelectedLoan(loan);
    setIsModalOpen(true);
    setScheduleLoading(true);
    try {
      const sched = await api.getLoanSchedule(loan.id);
      setSchedule(sched);
    } catch (err) {
      console.warn('[Schedule] error:', err);
    } finally {
      setScheduleLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading member loans...</Text>
      </View>
    );
  }

  const loansToDisplay = tab === 'active' ? activeLoans : completedLoans;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'active' && styles.tabButtonActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabButtonText, tab === 'active' && styles.tabButtonTextActive]}>
            Active Facilities ({activeLoans.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'completed' && styles.tabButtonActive]}
          onPress={() => setTab('completed')}
        >
          <Text style={[styles.tabButtonText, tab === 'completed' && styles.tabButtonTextActive]}>
            Loan History / Completed ({completedLoans.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loans List */}
      {loansToDisplay.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📁</Text>
          <Text style={styles.emptyTitle}>No {tab === 'active' ? 'active' : 'completed'} loans</Text>
          <Text style={styles.emptySubtitle}>
            {tab === 'active'
              ? 'You have no outstanding loan balance. Apply for a microfinance facility anytime!'
              : 'Completed loan facilities with zero balance will appear here for reference.'}
          </Text>
        </View>
      ) : (
        loansToDisplay.map((loan) => (
          <View key={loan.id} style={styles.loanCard}>
            <View style={styles.loanCardHeader}>
              <View>
                <Text style={styles.loanNumber}>{loan.loanNumber}</Text>
                <Text style={styles.loanProduct}>{loan.productName}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  loan.status === 'ACTIVE' || loan.status === 'APPROVED'
                    ? styles.statusActive
                    : styles.statusCompleted,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    loan.status === 'ACTIVE' || loan.status === 'APPROVED'
                      ? styles.statusTextActive
                      : styles.statusTextCompleted,
                  ]}
                >
                  {loan.status}
                </Text>
              </View>
            </View>

            {/* Principal vs Remaining Balance Progress */}
            <View style={styles.balanceRow}>
              <View>
                <Text style={styles.balanceLabel}>Remaining Balance</Text>
                <Text style={styles.balanceAmount}>₱ {(loan.remainingBalance || 0).toLocaleString()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.balanceLabel}>Original Principal</Text>
                <Text style={styles.principalAmount}>₱ {(loan.principalAmount || 0).toLocaleString()}</Text>
              </View>
            </View>

            {/* Metrics Breakdown Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Monthly Installment</Text>
                <Text style={styles.metricValue}>₱ {(loan.monthlyInstallment || 0).toLocaleString()}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Interest Rate</Text>
                <Text style={styles.metricValue}>{loan.interestRate}% p.a.</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Term Tenor</Text>
                <Text style={styles.metricValue}>{loan.termMonths} Months</Text>
              </View>
            </View>

            <View style={styles.loanDatesRow}>
              <Text style={styles.dateInfoText}>
                🗓️ Start: <Text style={{ fontWeight: '600' }}>{loan.startDate}</Text> • Maturity:{' '}
                <Text style={{ fontWeight: '600' }}>{loan.maturityDate}</Text>
              </Text>
            </View>

            {/* Schedule & History Button */}
            <TouchableOpacity
              style={styles.scheduleButton}
              onPress={() => openScheduleModal(loan)}
            >
              <Text style={styles.scheduleButtonText}>View Complete Payment Schedule →</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Payment Schedule Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Payment Schedule</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedLoan?.loanNumber} • {selectedLoan?.productName}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsModalOpen(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {scheduleLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color="#059669" />
              </View>
            ) : (
              <ScrollView style={styles.scheduleList}>
                {schedule.map((item) => (
                  <View key={item.installmentNumber} style={styles.scheduleItem}>
                    <View style={styles.schedLeft}>
                      <View style={styles.installmentNumberCircle}>
                        <Text style={styles.installmentNumberText}>{item.installmentNumber}</Text>
                      </View>
                      <View>
                        <Text style={styles.schedDueDate}>Due: {item.dueDate}</Text>
                        <Text style={styles.schedBreakdown}>
                          Principal: ₱{item.principal?.toLocaleString()} • Interest: ₱{item.interest?.toLocaleString()}
                        </Text>
                        {item.receiptNumber && (
                          <Text style={styles.schedReceipt}>Receipt: {item.receiptNumber}</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.schedRight}>
                      <Text style={styles.schedAmount}>₱ {item.amountDue?.toLocaleString()}</Text>
                      <View
                        style={[
                          styles.schedStatusBadge,
                          item.status === 'PAID'
                            ? styles.schedPaidBadge
                            : item.status === 'DUE'
                            ? styles.schedDueBadge
                            : styles.schedUpcomingBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.schedStatusText,
                            item.status === 'PAID'
                              ? styles.schedPaidText
                              : item.status === 'DUE'
                              ? styles.schedDueText
                              : styles.schedUpcomingText,
                          ]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalDoneButton}
              onPress={() => setIsModalOpen(false)}
            >
              <Text style={styles.modalDoneText}>Close Schedule</Text>
            </TouchableOpacity>
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
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  loanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  loanCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  loanNumber: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '700',
  },
  loanProduct: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#ECFDF5',
  },
  statusCompleted: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextActive: {
    color: '#059669',
  },
  statusTextCompleted: {
    color: '#475569',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  balanceLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  balanceAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  principalAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  loanDatesRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginBottom: 12,
  },
  dateInfoText: {
    fontSize: 11,
    color: '#64748B',
  },
  scheduleButton: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scheduleButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
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
    maxHeight: '80%',
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
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
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
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  scheduleList: {
    maxHeight: 400,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  schedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  installmentNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  installmentNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  schedDueDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  schedBreakdown: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  schedReceipt: {
    fontSize: 10,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 1,
  },
  schedRight: {
    alignItems: 'flex-end',
  },
  schedAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  schedStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  schedPaidBadge: {
    backgroundColor: '#ECFDF5',
  },
  schedDueBadge: {
    backgroundColor: '#FEF2F2',
  },
  schedUpcomingBadge: {
    backgroundColor: '#F8FAFC',
  },
  schedStatusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  schedPaidText: {
    color: '#059669',
  },
  schedDueText: {
    color: '#DC2626',
  },
  schedUpcomingText: {
    color: '#64748B',
  },
  modalDoneButton: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  modalDoneText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
