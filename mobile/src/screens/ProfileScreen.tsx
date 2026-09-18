import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { api } from '../services/api';
import { ClientProfile, KycDocument } from '../types';

export const ProfileScreen: React.FC = () => {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [kycDocs, setKycDocs] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields (Full details)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [civilStatus, setCivilStatus] = useState('');
  const [occupation, setOccupation] = useState('');
  const [employer, setEmployer] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');

  const fetchProfileData = async () => {
    try {
      const [profData, kycData] = await Promise.all([
        api.getProfile(),
        api.getKycStatus(),
      ]);
      setProfile(profData);
      setFullName(profData.fullName || '');
      setEmail(profData.email || '');
      setPhone(profData.phone || '');
      setDateOfBirth(profData.dateOfBirth || '');
      setAddress(profData.address || '');
      setCivilStatus(profData.civilStatus || 'Single');
      setOccupation(profData.occupation || '');
      setEmployer(profData.employer || '');
      setMonthlyIncome(profData.monthlyIncome ? String(profData.monthlyIncome) : '');
      setKycDocs(kycData.requiredDocuments || []);

      // If user is brand new (e.g. phone-only registration), auto-enable editing if empty name
      if (!profData.fullName || profData.fullName.startsWith('Member (') || profData.fullName === 'New Member') {
        setIsEditing(true);
      }
    } catch (err: any) {
      console.warn('[Profile] Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Full Name Required', 'Please enter your full legal name as it appears on your ID.');
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        dateOfBirth: dateOfBirth.trim(),
        address: address.trim(),
        civilStatus: civilStatus.trim(),
        occupation: occupation.trim(),
        employer: employer.trim(),
        monthlyIncome: monthlyIncome ? Number(monthlyIncome) : 0,
      });
      Alert.alert('Profile Updated 🎉', 'Your personal and membership information has been saved successfully.');
      setIsEditing(false);
      fetchProfileData();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const isProfileIncomplete =
    !profile?.fullName ||
    profile.fullName.startsWith('Member (') ||
    profile.fullName === 'New Member' ||
    !profile.address ||
    !profile.dateOfBirth;

  const handleAvatarChange = () => {
    Alert.prompt
      ? Alert.prompt(
          'Update Profile Picture',
          'Enter image URL or choose a preset photo:',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save',
              onPress: async (url?: string) => {
                if (url) {
                  await api.uploadAvatar(url);
                  fetchProfileData();
                }
              },
            },
          ],
          'plain-text',
          profile?.avatar
        )
      : Alert.alert(
          'Photo Upload',
          'Selected sample avatar from camera roll.',
          [
            {
              text: 'Set Avatar Photo',
              onPress: async () => {
                await api.uploadAvatar('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150');
                fetchProfileData();
              },
            },
            { text: 'Close' },
          ]
        );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading member profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Incomplete Profile Alert Banner for newly registered users */}
      {isProfileIncomplete && (
        <View style={styles.incompleteBanner}>
          <View style={styles.incompleteBannerHeader}>
            <Text style={styles.incompleteBannerIcon}>📝</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.incompleteBannerTitle}>Complete Your Profile Details</Text>
              <Text style={styles.incompleteBannerText}>
                You registered with your mobile number. Please fill in your legal name, residential address, and date of birth below to enable instant loan applications.
              </Text>
            </View>
          </View>
          {!isEditing && (
            <TouchableOpacity
              style={styles.incompleteActionBtn}
              onPress={() => setIsEditing(true)}
            >
              <Text style={styles.incompleteActionBtnText}>Fill Details Now →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Header Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarRow}>
          <TouchableOpacity onPress={handleAvatarChange} style={styles.avatarWrapper}>
            <Image
              source={{ uri: profile?.avatar || `https://ui-avatars.com/api/?background=059669&color=fff&name=${encodeURIComponent(profile?.fullName || 'User')}` }}
              style={styles.avatarImage}
            />
            <View style={styles.cameraIconBadge}>
              <Text style={{ fontSize: 10 }}>📷</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.avatarInfo}>
            <Text style={styles.profileName}>{profile?.fullName || 'New Member'}</Text>
            <Text style={styles.profileEmail}>{profile?.phone || profile?.email}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.memberIdBadge}>
                <Text style={styles.memberIdText}>{profile?.memberNumber || 'MBR-PENDING'}</Text>
              </View>
              <View style={[styles.kycBadge, profile?.kycStatus === 'VERIFIED' ? styles.kycVerified : styles.kycPending]}>
                <Text style={styles.kycText}>
                  {profile?.kycStatus === 'VERIFIED' ? '✓ KYC VERIFIED' : 'KYC PENDING'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Credit Standing & Membership Badge */}
      <View style={styles.creditCard}>
        <View style={styles.creditCol}>
          <Text style={styles.creditLabel}>Credit Score</Text>
          <Text style={styles.creditValue}>{profile?.creditScore || 680}</Text>
        </View>
        <View style={styles.creditDivider} />
        <View style={styles.creditCol}>
          <Text style={styles.creditLabel}>Standing Tier</Text>
          <Text style={[styles.creditValue, { color: '#059669' }]}>{profile?.creditTier || 'STANDARD'}</Text>
        </View>
        <View style={styles.creditDivider} />
        <View style={styles.creditCol}>
          <Text style={styles.creditLabel}>Member Since</Text>
          <Text style={styles.creditValue}>{profile?.membershipDate || '2026'}</Text>
        </View>
      </View>

      {/* Personal Information Form */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionHeader}>Personal & Member Information</Text>
          <Text style={styles.sectionSubHeader}>Update your profile details and loan application info</Text>
        </View>
        {!isEditing ? (
          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
            <Text style={styles.editButtonText}>Edit Details</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.cancelEditButton}
            onPress={() => {
              setIsEditing(false);
              fetchProfileData();
            }}
          >
            <Text style={styles.cancelEditText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.formCard}>
        {/* Full Legal Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Full Legal Name (Official Govt ID Name) *</Text>
          {isEditing ? (
            <TextInput
              style={[styles.fieldInput, styles.highlightInput]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Maria Teresa Alcantara"
            />
          ) : (
            <Text style={styles.fieldValue}>{profile?.fullName || 'Not specified'}</Text>
          )}
        </View>

        {/* Email Address */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email Address</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="e.g. teresa.alcantara@gmail.com"
            />
          ) : (
            <Text style={styles.fieldValue}>{profile?.email || 'Not specified'}</Text>
          )}
        </View>

        {/* Mobile Phone Number */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Mobile Phone Number *</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+63 917 555 4321"
            />
          ) : (
            <Text style={styles.fieldValue}>{phone || 'N/A'}</Text>
          )}
        </View>

        {/* Date of Birth */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Date of Birth (YYYY-MM-DD)</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="e.g. 1990-05-18"
            />
          ) : (
            <Text style={styles.fieldValue}>{dateOfBirth || 'Not specified'}</Text>
          )}
        </View>

        {/* Residential Address */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Residential Address</Text>
          {isEditing ? (
            <TextInput
              style={[styles.fieldInput, { height: 60 }]}
              value={address}
              onChangeText={setAddress}
              multiline
              placeholder="e.g. Brgy. 88, San Jose, Tacloban City, Leyte"
            />
          ) : (
            <Text style={styles.fieldValue}>{address || 'Not specified'}</Text>
          )}
        </View>

        {/* Civil Status */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Civil Status</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={civilStatus}
              onChangeText={setCivilStatus}
              placeholder="Single / Married / Widowed / Separated"
            />
          ) : (
            <Text style={styles.fieldValue}>{civilStatus || 'Single'}</Text>
          )}
        </View>

        {/* Occupation / Trade */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Occupation / Trade</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={occupation}
              onChangeText={setOccupation}
              placeholder="e.g. Micro-Enterprise Owner, Employee, Farmer"
            />
          ) : (
            <Text style={styles.fieldValue}>{occupation || 'Not specified'}</Text>
          )}
        </View>

        {/* Business / Employer Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Business / Employer Name</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={employer}
              onChangeText={setEmployer}
              placeholder="e.g. Alcantara Variety Store"
            />
          ) : (
            <Text style={styles.fieldValue}>{employer || 'Not specified'}</Text>
          )}
        </View>

        {/* Monthly Income */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Estimated Monthly Income (₱)</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={monthlyIncome}
              onChangeText={setMonthlyIncome}
              keyboardType="numeric"
              placeholder="e.g. 35000"
            />
          ) : (
            <Text style={styles.fieldValue}>
              {monthlyIncome ? `₱ ${Number(monthlyIncome).toLocaleString()}` : 'Not specified'}
            </Text>
          )}
        </View>

        {isEditing && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>💾 Save All Profile Details</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* KYC / Verification Status Details */}
      <Text style={[styles.sectionHeader, { marginTop: 24 }]}>Verification & KYC Documents</Text>
      <View style={styles.kycContainer}>
        {kycDocs.map((doc, idx) => (
          <View key={idx} style={styles.kycItem}>
            <View style={styles.kycIconBg}>
              <Text style={{ fontSize: 14 }}>{doc.submitted ? '📄' : '⚠️'}</Text>
            </View>
            <View style={styles.kycDetails}>
              <Text style={styles.kycDocName}>{doc.name}</Text>
              <Text style={styles.kycDocType}>{doc.type}</Text>
            </View>
            <View style={[styles.kycStatusTag, doc.status === 'VERIFIED' ? styles.kycTagVerified : styles.kycTagPending]}>
              <Text style={styles.kycTagText}>{doc.status}</Text>
            </View>
          </View>
        ))}
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
  incompleteBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  incompleteBannerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  incompleteBannerIcon: {
    fontSize: 22,
    marginRight: 10,
    marginTop: 2,
  },
  incompleteBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  incompleteBannerText: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 17,
  },
  incompleteActionBtn: {
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  incompleteActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E2E8F0',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  avatarInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  memberIdBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  memberIdText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  kycBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kycVerified: {
    backgroundColor: '#ECFDF5',
  },
  kycPending: {
    backgroundColor: '#FFFBEB',
  },
  kycText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  creditCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
  },
  creditCol: {
    flex: 1,
    alignItems: 'center',
  },
  creditLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  creditValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  creditDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  sectionSubHeader: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  editButton: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  cancelEditButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelEditText: {
    fontSize: 12,
    color: '#64748B',
  },
  kycContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  kycItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  kycIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  kycDetails: {
    flex: 1,
  },
  kycDocName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  kycDocType: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  kycStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kycTagVerified: {
    backgroundColor: '#ECFDF5',
  },
  kycTagPending: {
    backgroundColor: '#FFFBEB',
  },
  kycTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  fieldInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  highlightInput: {
    borderColor: '#059669',
    backgroundColor: '#FAFCFB',
  },
  saveButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
