import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, AppModal, AppButton, Avatar, Badge, LoadingView, MenuItem } from '../../components';
import { colors } from '../../theme';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ClientProfile } from '../../types';
import { formatCurrency } from '../../utils/format';

export const MoreScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const p = await api.getProfile();
          setProfile(p);
        } catch {}
        setLoaded(true);
      })();
    }, [])
  );

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await api.logout();
    } catch {}
    await signOut();
  };

  const user = session?.user;
  const kycStatus = profile?.kycStatus;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!loaded ? (
          <LoadingView style={{ minHeight: 200 }} />
        ) : (
          <AppCard style={styles.profileCard} padded={false}>
            <View style={styles.profileBody}>
              <Avatar name={user?.fullName} size={56} uri={profile?.avatar} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{profile?.fullName ?? user?.fullName}</Text>
                <Text style={styles.profileMeta}>Member No. {profile?.memberNumber ?? '—'}</Text>
                {kycStatus ? (
                  <View style={{ marginTop: 6 }}>
                    <Badge status={kycStatus} dot />
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} onPress={() => navigation.navigate('Profile')} />
            </View>
          </AppCard>
        )}

        <AppCard style={styles.menuCard} padded={false}>
          <MenuItem icon="person-outline" label="My Profile" subtitle="Personal details and documents" onPress={() => navigation.navigate('Profile')} />
          <MenuItem icon="shield-outline" label="KYC Verification" subtitle="Identity verification status" onPress={() => navigation.navigate('KycStatus')} />
          <MenuItem icon="people-outline" label="Group Lending" subtitle="Solidarity groups & center meetings" onPress={() => navigation.navigate('GroupLending')} />
          <MenuItem icon="receipt-outline" label="Transactions" subtitle="Full history, filters, and receipts" onPress={() => navigation.navigate('Transactions')} />
          <MenuItem icon="folder-open-outline" label="My Documents" subtitle="Downloadable certificates and records" onPress={() => navigation.navigate('Documents')} last={false} />
          <MenuItem icon="settings-outline" label="Settings" subtitle="Security, privacy & preferences" onPress={() => navigation.navigate('Settings')} last={false} />
          <MenuItem icon="help-circle-outline" label="Help & Support" subtitle="FAQs, contact details, and tickets" onPress={() => navigation.navigate('HelpSupport')} last />
        </AppCard>

        <AppCard style={styles.menuCard} padded={false}>
          <MenuItem
            icon="log-out-outline"
            label="Sign Out"
            subtitle={user?.email}
            danger
            onPress={() => setLogoutVisible(true)}
            last
          />
        </AppCard>

        <Text style={styles.version}>HOSCOMCO Mobile App · Version 2.0.0</Text>
      </ScrollView>

      <AppModal
        visible={logoutVisible}
        onClose={() => setLogoutVisible(false)}
        title="Sign Out?"
        subtitle="You will need to sign in again to access your account."
        icon="log-out-outline"
        iconColor={colors.danger}
        iconBg={colors.dangerSoft}
        confirmText="Sign Out"
        confirmVariant="danger"
        onConfirm={handleSignOut}
        confirmLoading={signingOut}
      >
        <Text style={styles.logoutNote}>
          Make sure your transactions are synced. Your session will be cleared from this device.
        </Text>
      </AppModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  profileCard: { marginBottom: 14 },
  profileBody: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  profileInfo: { flex: 1, marginLeft: 14, marginRight: 8 },
  profileName: { fontSize: 17, fontWeight: '800', color: colors.text },
  profileMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  menuCard: { marginBottom: 14, paddingHorizontal: 16 },
  logoutNote: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  version: { fontSize: 10, color: colors.textFaint, textAlign: 'center', marginTop: 6 },
});