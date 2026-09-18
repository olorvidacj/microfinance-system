import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { api } from '../services/api';
import { ClientDashboardData } from '../types';

interface DashboardScreenProps {
  onNavigate: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const [data, setData] = useState<ClientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      console.warn('[Dashboard] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading account summary...</Text>
      </View>
    );
  }

  const formatCurrency = (val?: number) => {
    return `₱ ${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} />}
    >
      {/* Welcome Card */}
      <View style={styles.welcomeCard}>
        <View>
          <Text style={styles.welcomeGreeting}>Welcome back,</Text>
          <Text style={styles.welcomeName}>{data?.borrowerName || 'Coop Member'}</Text>
          <Text style={styles.memberBadge}>Passbook No: {data?.memberNumber || 'MBR-2024-001'}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{data?.loanStatus || 'ACTIVE'}</Text>
        </View>
      </View>

      {/* Main Loan Metrics Hero Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Total Remaining Balance</Text>
        <Text style={styles.heroValue}>{formatCurrency(data?.remainingBalance)}</Text>

        <View style={styles.heroDivider} />

        <View style={styles.heroGrid}>
          <View style={styles.heroCol}>
            <Text style={styles.heroSubLabel}>Total Active Loans</Text>
            <Text style={styles.heroSubValue}>{formatCurrency(data?.totalActiveLoan)}</Text>
          </View>
          <View style={styles.heroCol}>
            <Text style={styles.heroSubLabel}>Next Installment</Text>
            <Text style={[styles.heroSubValue, { color: '#059669' }]}>
              {formatCurrency(data?.nextPayment)}
            </Text>
          </View>
        </View>

        <View style={styles.dueDateBadge}>
          <Text style={styles.dueDateText}>
            📅 Next Due Date: <Text style={{ fontWeight: '700' }}>{data?.nextPaymentDueDate || '2026-09-15'}</Text>
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Services</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => onNavigate('apply')}
        >
          <View style={[styles.actionIconBg, { backgroundColor: '#ECFDF5' }]}>
            <Text style={styles.actionEmoji}>📝</Text>
          </View>
          <Text style={styles.actionTitle}>Apply for Loan</Text>
          <Text style={styles.actionDesc}>Self-service application</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => onNavigate('payments')}
        >
          <View style={[styles.actionIconBg, { backgroundColor: '#FFFBEB' }]}>
            <Text style={styles.actionEmoji}>💳</Text>
          </View>
          <Text style={styles.actionTitle}>Pay / Proof</Text>
          <Text style={styles.actionDesc}>Submit payment slip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => onNavigate('loans')}
        >
          <View style={[styles.actionIconBg, { backgroundColor: '#FAF5FF' }]}>
            <Text style={styles.actionEmoji}>📊</Text>
          </View>
          <Text style={styles.actionTitle}>Loan Schedule</Text>
          <Text style={styles.actionDesc}>Amortization breakdown</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => onNavigate('profile')}
        >
          <View style={[styles.actionIconBg, { backgroundColor: '#FFFBEB' }]}>
            <Text style={styles.actionEmoji}>🛡️</Text>
          </View>
          <Text style={styles.actionTitle}>KYC & Profile</Text>
          <Text style={styles.actionDesc}>Verify membership</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Transactions List */}
      <View style={styles.transactionsHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <TouchableOpacity onPress={() => onNavigate('payments')}>
          <Text style={styles.viewAllText}>View All →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.transactionList}>
        {data?.recentTransactions && data.recentTransactions.length > 0 ? (
          data.recentTransactions.map((tx) => (
            <View key={tx.id} style={styles.transactionItem}>
              <View style={styles.txIconContainer}>
                <Text style={styles.txIcon}>
                  {tx.type === 'REPAYMENT' ? '💸' : '💰'}
                </Text>
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txTitle}>
                  {tx.type === 'REPAYMENT' ? 'Loan Repayment' : 'Savings Deposit'}
                </Text>
                <Text style={styles.txMeta}>
                  {tx.date} • {tx.paymentMethod}
                </Text>
                <Text style={styles.txRef}>Ref: {tx.referenceNumber}</Text>
              </View>
              <View style={styles.txAmountContainer}>
                <Text
                  style={[
                    styles.txAmount,
                    tx.type === 'REPAYMENT' ? styles.txAmountRepayment : styles.txAmountDeposit,
                  ]}
                >
                  {formatCurrency(tx.amount)}
                </Text>
                <Text style={styles.txStatus}>{tx.status}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No recent transactions found.</Text>
          </View>
        )}
      </View>
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
    paddingBottom: 32,
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
  welcomeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  welcomeGreeting: {
    fontSize: 12,
    color: '#64748B',
  },
  welcomeName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  memberBadge: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 4,
  },
  statusPill: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  heroLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  heroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCol: {
    flex: 1,
  },
  heroSubLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 2,
  },
  heroSubValue: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  dueDateBadge: {
    marginTop: 16,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  dueDateText: {
    color: '#E2E8F0',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionEmoji: {
    fontSize: 18,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  viewAllText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
  },
  transactionList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  txIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txIcon: {
    fontSize: 18,
  },
  txDetails: {
    flex: 1,
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  txMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  txRef: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  txAmountContainer: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txAmountRepayment: {
    color: '#0F172A',
  },
  txAmountDeposit: {
    color: '#059669',
  },
  txStatus: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});
