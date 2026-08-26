import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';

/**
 * HOSCOMO Microfinance - React Native & Expo Mobile Client
 * Architecture:
 * - Frontend Mobile: React Native, Expo
 * - Backend: Node.js + Express.js REST API
 * - Database & Auth: Supabase / PostgreSQL + RBAC
 * - Security: Backend communicates with Supabase server-side. No service keys in client.
 */

interface UserSession {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: 'STAFF' | 'CLIENT';
    staffRole?: string;
  };
}

export default function App() {
  const [email, setEmail] = useState('client@hoscomo.coop');
  const [password, setPassword] = useState('client123');
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'loans' | 'savings' | 'apply'>('dashboard');

  const API_BASE_URL = 'http://localhost:3000/api';

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        Alert.alert('Login Failed', data.error || 'Check credentials.');
      } else {
        setSession({ token: data.token, user: data.user });
      }
    } catch (err: any) {
      Alert.alert('Network Error', 'Unable to reach HOSCOMO server at ' + API_BASE_URL);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setSession(null);
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loginCard}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>HOSCOMO MICROFINANCE</Text>
          </View>
          <Text style={styles.loginTitle}>Client & Staff Portal</Text>
          <Text style={styles.loginSubtitle}>React Native + Expo Mobile Application</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="e.g. client@hoscomo.coop"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In Securely</Text>
            )}
          </TouchableOpacity>

          <View style={styles.presetContainer}>
            <Text style={styles.presetTitle}>Quick Demo Credentials:</Text>
            <TouchableOpacity
              onPress={() => {
                setEmail('client@hoscomo.coop');
                setPassword('client123');
              }}
            >
              <Text style={styles.presetLink}>• Client: client@hoscomo.coop (client123)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setEmail('admin@hoscomo.coop');
                setPassword('admin123');
              }}
            >
              <Text style={styles.presetLink}>• Admin: admin@hoscomo.coop (admin123)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{session.user.fullName}</Text>
          <Text style={styles.headerRole}>
            {session.user.role === 'CLIENT' ? 'Coop Member (Self-Service)' : session.user.staffRole || 'Staff'}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'loans' && styles.navItemActive]}
          onPress={() => setActiveTab('loans')}
        >
          <Text style={[styles.navText, activeTab === 'loans' && styles.navTextActive]}>My Loans</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'savings' && styles.navItemActive]}
          onPress={() => setActiveTab('savings')}
        >
          <Text style={[styles.navText, activeTab === 'savings' && styles.navTextActive]}>Savings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'apply' && styles.navItemActive]}
          onPress={() => setActiveTab('apply')}
        >
          <Text style={[styles.navText, activeTab === 'apply' && styles.navTextActive]}>Apply</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'dashboard' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Summary</Text>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Active Loan Balance</Text>
              <Text style={styles.statValue}>₱ 48,500.00</Text>
            </View>
            <View style={[styles.statBox, { marginTop: 12 }]}>
              <Text style={styles.statLabel}>Total Regular Savings</Text>
              <Text style={[styles.statValue, { color: '#059669' }]}>₱ 32,800.00</Text>
            </View>
          </View>
        )}

        {activeTab === 'loans' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Current Active Facility</Text>
            <Text style={styles.bodyText}>Micro-Enterprise Revolving Loan</Text>
            <Text style={styles.subText}>Next Due Date: 15th of the month</Text>
            <Text style={styles.subText}>Monthly Amortization: ₱ 4,850.00</Text>
          </View>
        )}

        {activeTab === 'savings' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Compulsory & Voluntary Deposits</Text>
            <Text style={styles.bodyText}>Account No: SA-2024-0089</Text>
            <Text style={styles.subText}>Share Capital: ₱ 20,000.00</Text>
            <Text style={styles.subText}>Time Deposit: ₱ 12,800.00</Text>
          </View>
        )}

        {activeTab === 'apply' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Apply for Micro-Loan or Savings</Text>
            <Text style={styles.bodyText}>Submit loan requests directly through the mobile portal with zero paper forms.</Text>
            <TouchableOpacity
              style={[styles.loginButton, { marginTop: 16 }]}
              onPress={() => Alert.alert('Application Submitted', 'Your loan request has been routed to the Credit Committee.')}
            >
              <Text style={styles.loginButtonText}>Submit New Application</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loginCard: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  brandBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  brandBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  loginSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  loginButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  presetContainer: {
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  presetTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  presetLink: {
    fontSize: 12,
    color: '#0284C7',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerRole: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  logoutButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  navItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  navItemActive: {
    borderBottomColor: '#059669',
  },
  navText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  navTextActive: {
    color: '#059669',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  statBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  bodyText: {
    fontSize: 14,
    color: '#1E293B',
    marginBottom: 4,
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
});
