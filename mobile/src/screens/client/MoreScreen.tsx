import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, AppModal, Avatar, Badge, LoadingView, MenuItem } from '../../components';
import { colors } from '../../theme';
import { api, messageOf } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { ClientProfileView } from '../../shared/client';
import type { MoreStackParamList } from '../../navigation/types';

export const MoreScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<ClientProfileView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setProfile(await api.getProfile());
          setError('');
        } catch (err) {
          setError(messageOf(err, 'Your profile could not be loaded.'));
        } finally {
          setLoaded(true);
        }
      })();
    }, []),
  );

  const handleSignOut = async () => {
    setSigningOut(true);
    // The device session is cleared even when the server cannot be reached;
    // the server token then simply expires.
    try {
      await api.logout();
    } finally {
      await signOut();
    }
  };

  const user = session?.user;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!loaded ? (
          <LoadingView style={{ minHeight: 200 }} />
        ) : (
          <AppCard style={styles.profileCard} padded={false}>
            <View style={styles.profileBody}>
              <Avatar name={profile?.fullName ?? user?.fullName} size={56} uri={profile?.avatar || undefined} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{profile?.fullName ?? user?.fullName}</Text>
                <Text style={styles.profileMeta}>Member No. {profile?.memberNumber || '—'}</Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                {profile?.kycStatus ? (
                  <View style={{ marginTop: 6 }}>
                    <Badge status={profile.kycStatus} dot />
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} onPress={() => navigation.navigate('Profile')} />
            </View>
          </AppCard>
        )}

        <AppCard style={styles.menuCard} padded={false}>
          <MenuItem icon="person-outline" label="My Profile" subtitle="Personal details" onPress={() => navigation.navigate('Profile')} />
          <MenuItem icon="shield-outline" label="KYC Verification" subtitle="Identity verification status" onPress={() => navigation.navigate('KycStatus')} />
          <MenuItem icon="people-outline" label="Group Lending" subtitle="Your solidarity group and meetings" onPress={() => navigation.navigate('GroupLending')} />
          <MenuItem icon="receipt-outline" label="Transactions" subtitle="Payments, disbursements and savings" onPress={() => navigation.navigate('Transactions')} />
          <MenuItem icon="folder-open-outline" label="My Documents" subtitle="Your KYC and loan papers" onPress={() => navigation.navigate('Documents')} />
          <MenuItem icon="settings-outline" label="Settings" subtitle="Password and recent sign-ins" onPress={() => navigation.navigate('Settings')} />
          <MenuItem icon="help-circle-outline" label="Help & Support" subtitle="FAQs and messages to your branch" onPress={() => navigation.navigate('HelpSupport')} last />
        </AppCard>

        <AppCard style={styles.menuCard} padded={false}>
          <MenuItem icon="log-out-outline" label="Sign Out" subtitle={user?.email} danger onPress={() => setLogoutVisible(true)} last />
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
        <Text style={styles.logoutNote}>Your session will be cleared from this device.</Text>
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
  error: { fontSize: 11, color: colors.danger, marginTop: 4 },
  menuCard: { marginBottom: 14, paddingHorizontal: 16 },
  logoutNote: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  version: { fontSize: 10, color: colors.textFaint, textAlign: 'center', marginTop: 6 },
});
