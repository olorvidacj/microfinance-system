import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { UserSession } from './src/types';
import { api } from './src/services/api';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LoanApplicationScreen } from './src/screens/LoanApplicationScreen';
import { LoansScreen } from './src/screens/LoansScreen';
import { PaymentsScreen } from './src/screens/PaymentsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';

type TabType = 'dashboard' | 'apply' | 'loans' | 'payments' | 'profile';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Check unread notifications periodically
  useEffect(() => {
    if (session) {
      api
        .getNotifications()
        .then((data) => setUnreadNotifCount(data.unreadCount || 0))
        .catch(() => {});
    }
  }, [session, isNotifModalOpen, activeTab]);

  const handleLoginSuccess = (userSession: UserSession) => {
    setSession(userSession);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    Alert.alert('Confirm Sign Out', 'Are you sure you want to sign out of the mobile app?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await api.logout();
          setSession(null);
        },
      },
    ]);
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <AuthScreen onSuccess={handleLoginSuccess} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Top Mobile App Header */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Text style={{ fontSize: 16 }}>🏛️</Text>
          </View>
          <View>
            <Text style={styles.brandName}>HOSCOMCO Mobile</Text>
            <Text style={styles.userName}>{session.user.fullName}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {/* Notifications Bell with Badge */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setIsNotifModalOpen(true)}
          >
            <Text style={{ fontSize: 18 }}>🔔</Text>
            {unreadNotifCount > 0 && (
              <View style={styles.badgeDot}>
                <Text style={styles.badgeText}>{unreadNotifCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Screen Content */}
      <View style={styles.screenContainer}>
        {activeTab === 'dashboard' && <DashboardScreen onNavigate={(t) => setActiveTab(t as TabType)} />}
        {activeTab === 'apply' && <LoanApplicationScreen />}
        {activeTab === 'loans' && <LoansScreen />}
        {activeTab === 'payments' && <PaymentsScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navTab, activeTab === 'dashboard' && styles.navTabActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={[styles.navLabel, activeTab === 'dashboard' && styles.navLabelActive]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'apply' && styles.navTabActive]}
          onPress={() => setActiveTab('apply')}
        >
          <Text style={styles.navIcon}>📝</Text>
          <Text style={[styles.navLabel, activeTab === 'apply' && styles.navLabelActive]}>
            Apply
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'loans' && styles.navTabActive]}
          onPress={() => setActiveTab('loans')}
        >
          <Text style={styles.navIcon}>📊</Text>
          <Text style={[styles.navLabel, activeTab === 'loans' && styles.navLabelActive]}>
            Loans
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'payments' && styles.navTabActive]}
          onPress={() => setActiveTab('payments')}
        >
          <Text style={styles.navIcon}>💳</Text>
          <Text style={[styles.navLabel, activeTab === 'payments' && styles.navLabelActive]}>
            Payments
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'profile' && styles.navTabActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={styles.navIcon}>🛡️</Text>
          <Text style={[styles.navLabel, activeTab === 'profile' && styles.navLabelActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications Modal View */}
      <Modal visible={isNotifModalOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.notifModalHeader}>
            <Text style={styles.notifModalTitle}>Notifications & Alerts</Text>
            <TouchableOpacity
              style={styles.notifCloseBtn}
              onPress={() => setIsNotifModalOpen(false)}
            >
              <Text style={styles.notifCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <NotificationsScreen />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  brandName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  userName: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#DC2626',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  logoutText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  navTab: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navTabActive: {
    backgroundColor: '#ECFDF5',
  },
  navIcon: {
    fontSize: 18,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#059669',
    fontWeight: '800',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  notifModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  notifModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  notifCloseBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  notifCloseText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
