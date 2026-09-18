import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppButton, AppCard, AppModal, AppTextInput, DocRow, LoadingView, ScreenHeader, WizardHeader } from '../../components';
import { colors, radius } from '../../theme';
import { api } from '../../services/api';
import { KycSubmissionPayload, KycRequiredDocumentItem, ClientProfile } from '../../types';
import { validators } from '../../utils/validation';

const STEPS = [
  { title: 'Personal Information', subtitle: 'Confirm the details on your valid ID' },
  { title: 'Address', subtitle: 'Your current residential address' },
  { title: 'Employment / Income', subtitle: 'Your source of livelihood' },
  { title: 'Documents', subtitle: 'Upload clear photos of required documents' },
  { title: 'Review & Submit', subtitle: 'Check everything before submitting' },
];

const GENDERS = ['Female', 'Male', 'Prefer not to say'];
const CIVIL_STATUS = ['Single', 'Married', 'Widowed', 'Separated'];
const EMPLOYMENT_STATUS = ['Self-Employed', 'Employed', 'Unemployed', 'Retired', 'Student', 'Other'];
const INCOME_SOURCES = [
  'Business / Self-Employment',
  'Salary / Employment',
  'Agriculture / Farming',
  'Family Support',
  'Pension / Remittances',
  'Other',
];

interface DocUpload {
  documentType: string;
  documentName: string;
  fileName?: string;
  fileUrl?: string;
  status: 'PENDING' | 'UPLOADING' | 'DONE' | 'ERROR';
}

export const KycFormScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loadingInit, setLoadingInit] = useState(true);
  const [mediaPermission, setMediaPermission] = useState<boolean | null>(null);

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [civilStatus, setCivilStatus] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [occupation, setOccupation] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [employer, setEmployer] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [sourceOfIncome, setSourceOfIncome] = useState('');

  const [requiredDocs, setRequiredDocs] = useState<KycRequiredDocumentItem[]>([]);
  const [uploads, setUploads] = useState<DocUpload[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ referenceNumber?: string; message?: string }>({});
  const [pickTarget, setPickTarget] = useState<DocUpload | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingInit(true);
      try {
        const [docs, profile] = await Promise.all([
          api.getKycRequiredDocuments(),
          api.getProfile().catch(() => null),
        ]);
        setRequiredDocs(docs);
        if (docs.length) {
          setUploads(
            docs.map((d) => ({
              documentType: d.documentType,
              documentName: d.documentName || d.documentType.replace(/_/g, ' '),
              status: 'PENDING',
            }))
          );
        }
        if (profile) {
          setFirstName(profile.firstName ?? profile.fullName.split(' ')[0] ?? '');
          setMiddleName(profile.middleName ?? '');
          setLastName(profile.lastName ?? '');
          setDateOfBirth(profile.dateOfBirth || '');
          setGender(profile.gender ?? '');
          setCivilStatus(profile.civilStatus || '');
          setPhone(profile.phone || '');
          setEmail(profile.email || '');
          setStreet(profile.street ?? profile.houseUnit ?? '');
          setBarangay(profile.barangay ?? '');
          setCity(profile.city ?? '');
          setProvince(profile.province ?? '');
          setPostalCode(profile.postalCode ?? '');
          setOccupation(profile.occupation || '');
          setEmployer(profile.employer || '');
          setMonthlyIncome(profile.monthlyIncome ? String(profile.monthlyIncome) : '');
        }
      } catch (err: any) {
        // Required docs API failed; leave lists empty.
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);

  const requestPermission = useCallback(async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setMediaPermission(res.granted);
    return res.granted;
  }, []);

  const pickFor = async (doc: DocUpload) => {
    // Request media permission first if needed
    if (!mediaPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    // Small delay to let the modal fully dismiss before launching the native picker
    // (important on Android — the native modal animation needs to finish first)
    await new Promise((resolve) => setTimeout(resolve, 350));

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    const fileName = asset.fileName || `kyc-${doc.documentType.toLowerCase()}-${Date.now()}.jpg`;
    // Determine MIME type from the URI extension
    const uriLower = (asset.uri || '').toLowerCase();
    const mime = uriLower.endsWith('.png') ? 'image/png' : uriLower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

    setUploads((prev) =>
      prev.map((u) => (u.documentType === doc.documentType ? { ...u, status: 'UPLOADING', fileName, fileUrl: asset.uri } : u))
    );
    try {
      // Read the image as a base64 string — the backend requires imageBase64, not a local URI
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const imageBase64 = `data:${mime};base64,${base64}`;

      const uploaded = await api.uploadKycDocument({
        documentType: doc.documentType,
        documentName: doc.documentName,
        fileName,
        imageBase64,
        mime,
      });
      setUploads((prev) =>
        prev.map((u) =>
          u.documentType === doc.documentType
            ? { ...u, fileName: uploaded?.document?.fileName ?? fileName, fileUrl: uploaded?.document?.fileUrl ?? asset.uri, status: 'DONE' }
            : u
        )
      );
    } catch (err: any) {
      console.warn('[KYC Upload] Error:', err?.message);
      setUploads((prev) =>
        prev.map((u) => (u.documentType === doc.documentType ? { ...u, status: 'ERROR' } : u))
      );
      setErrors((e) => ({ ...e, documents: err?.message || 'Upload failed. Please try again.' }));
    }
  };

  const set = (key: string) => (value: any) => {
    const setters: Record<string, (v: any) => void> = {
      firstName: setFirstName,
      middleName: setMiddleName,
      lastName: setLastName,
      dateOfBirth: setDateOfBirth,
      phone: setPhone,
      email: setEmail,
      street: setStreet,
      barangay: setBarangay,
      city: setCity,
      province: setProvince,
      postalCode: setPostalCode,
      occupation: setOccupation,
      employer: setEmployer,
      monthlyIncome: setMonthlyIncome,
    };
    setters[key]?.(value);
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!validators.required(firstName)) e.firstName = validators.required(firstName, 'First name') as string;
      if (!validators.required(lastName)) e.lastName = validators.required(lastName, 'Last name') as string;
      const dob = validators.dateOfBirth(dateOfBirth);
      if (dob) e.dateOfBirth = dob;
      if (!gender) e.gender = 'Select a gender.';
      if (!civilStatus) e.civilStatus = 'Select civil status.';
      const ph = validators.phonePolicy(phone);
      if (ph) e.phone = ph;
      if (email) {
        const em = validators.email(email);
        if (em) e.email = em;
      }
    }
    if (s === 1) {
      if (!validators.required(barangay)) e.barangay = validators.required(barangay, 'Barangay') as string;
      if (!validators.required(city)) e.city = validators.required(city, 'City / Municipality') as string;
      if (!validators.required(province)) e.province = validators.required(province, 'Province') as string;
    }
    if (s === 2) {
      if (!validators.required(occupation)) e.occupation = validators.required(occupation, 'Occupation') as string;
      if (!employmentStatus) e.employmentStatus = 'Select employment status.';
      const inc = validators.amount(monthlyIncome);
      if (inc) e.monthlyIncome = inc;
      if (!sourceOfIncome) e.sourceOfIncome = 'Select source of income.';
    }
    if (s === 3) {
      const missing = uploads.filter((u) => u.status !== 'DONE');
      if (missing.length === uploads.length) {
        e.documents = 'Upload clear photos of the required documents to continue.';
      } else if (missing.length) {
        e.documents = `${missing.length} document${missing.length > 1 ? 's' : ''} still need${missing.length > 1 ? '' : 's'} an upload.`;
      }
      if (missing.some((m) => m.status === 'ERROR')) e.documents = 'One or more uploads failed. Tap the document to try again.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate(step)) setStep((s) => s + 1);
  };

  const back = () => {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  };

  const handleSubmit = async () => {
    if (!validate(3)) {
      setStep(3);
      return;
    }
    setSubmitting(true);
    try {
      const payload: KycSubmissionPayload = {
        personalInfo: {
          firstName,
          middleName,
          lastName,
          dateOfBirth,
          gender,
          civilStatus,
          phone,
          email: email || undefined,
        },
        address: {
          street: street || undefined,
          barangay,
          city,
          province,
          postalCode: postalCode || undefined,
        },
        employment: {
          occupation,
          employmentStatus: employmentStatus || undefined,
          employer: employer || undefined,
          monthlyIncome: Number(monthlyIncome) || 0,
          sourceOfIncome: sourceOfIncome || occupation,
        },
      };
      const res = await api.submitKyc(payload);
      setResult({ referenceNumber: res.referenceNumber, message: res.message });
      setSubmitted(true);
    } catch (err: any) {
      setErrors({ submit: err?.message || 'Submission failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const ChipGroup = ({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (v: string) => void }) => (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <TouchableOpacity key={opt} style={[styles.chip, active && styles.chipActive]} onPress={() => onSelect(opt)} activeOpacity={0.8}>
            <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={active ? colors.white : colors.textFaint} />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (loadingInit) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Complete KYC" />
        <LoadingView />
      </SafeAreaView>
    );
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={34} color={colors.white} />
          </View>
          <Text style={styles.successTitle}>Submitted for Review</Text>
          <Text style={styles.successMsg}>
            {result.message || 'Your KYC documents have been submitted for verification by branch personnel.'}
          </Text>
          <AppCard style={styles.receiptCard}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Reference No.</Text>
              <Text style={styles.metaValue}>{result.referenceNumber ?? '—'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status</Text>
              <Text style={styles.metaValue}>Pending Review</Text>
            </View>
          </AppCard>
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <AppButton title="View My KYC Status" onPress={() => (navigation as any).replace('KycStatus')} />
          </View>
          <TouchableOpacity style={styles.homeLink} onPress={() => (navigation as any).popToTop()}>
            <Text style={styles.homeLinkText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const allUploaded = uploads.length > 0 && uploads.every((u) => u.status === 'DONE');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Complete KYC Verification" subtitle="Step-by-step secure verification" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <WizardHeader steps={STEPS} current={step} />

          {errors.submit ? (
            <View style={styles.submitError}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.submitErrorText}>{errors.submit}</Text>
            </View>
          ) : null}

          {step === 0 && (
            <View>
              <AppTextInput label="First Name *" value={firstName} placeholder="As shown on your valid ID" onChangeText={set('firstName')} error={errors.firstName} />
              <AppTextInput label="Middle Name" value={middleName} placeholder="Optional" onChangeText={set('middleName')} error={errors.middleName} />
              <AppTextInput label="Last Name *" value={lastName} placeholder="As shown on your valid ID" onChangeText={set('lastName')} error={errors.lastName} />
              <AppTextInput label="Date of Birth *" value={dateOfBirth} placeholder="YYYY-MM-DD" onChangeText={set('dateOfBirth')} error={errors.dateOfBirth} hint="Format: 1990-05-18" />
              <Text style={styles.fieldLabel}>Gender *</Text>
              <ChipGroup options={GENDERS} selected={gender} onSelect={(v) => { setGender(v); setErrors((e) => ({ ...e, gender: '' })); }} />
              {errors.gender ? <Text style={styles.fieldError}>{errors.gender}</Text> : null}
              <Text style={styles.fieldLabel}>Civil Status *</Text>
              <ChipGroup options={CIVIL_STATUS} selected={civilStatus} onSelect={(v) => { setCivilStatus(v); setErrors((e) => ({ ...e, civilStatus: '' })); }} />
              {errors.civilStatus ? <Text style={styles.fieldError}>{errors.civilStatus}</Text> : null}
              <AppTextInput label="Mobile Number *" value={phone} placeholder="e.g. 0917 555 4321" onChangeText={set('phone')} keyboardType="phone-pad" error={errors.phone} />
              <AppTextInput label="Email (Optional)" value={email} placeholder="e.g. you@gmail.com" onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
            </View>
          )}

          {step === 1 && (
            <View>
              <AppTextInput label="House / Street" value={street} placeholder="House no., street, building" onChangeText={set('street')} error={errors.street} />
              <AppTextInput label="Barangay *" value={barangay} placeholder="e.g. Poblacion" onChangeText={set('barangay')} error={errors.barangay} />
              <AppTextInput label="City / Municipality *" value={city} placeholder="e.g. Tacloban City" onChangeText={set('city')} error={errors.city} />
              <AppTextInput label="Province *" value={province} placeholder="e.g. Leyte" onChangeText={set('province')} error={errors.province} />
              <AppTextInput label="Postal Code" value={postalCode} placeholder="e.g. 6500" onChangeText={set('postalCode')} keyboardType="number-pad" error={errors.postalCode} />
            </View>
          )}

          {step === 2 && (
            <View>
              <AppTextInput label="Occupation *" value={occupation} placeholder="e.g. Store Owner, Farmer, Teacher" onChangeText={set('occupation')} error={errors.occupation} />
              <Text style={styles.fieldLabel}>Employment Status *</Text>
              <ChipGroup options={EMPLOYMENT_STATUS} selected={employmentStatus} onSelect={(v) => { setEmploymentStatus(v); setErrors((e) => ({ ...e, employmentStatus: '' })); }} />
              {errors.employmentStatus ? <Text style={styles.fieldError}>{errors.employmentStatus}</Text> : null}
              <AppTextInput label="Employer / Business Name" value={employer} placeholder="Optional" onChangeText={set('employer')} error={errors.employer} />
              <AppTextInput label="Monthly Income (₱) *" value={monthlyIncome} placeholder="e.g. 35000" onChangeText={set('monthlyIncome')} keyboardType="numeric" error={errors.monthlyIncome} />
              <Text style={styles.fieldLabel}>Source of Income *</Text>
              <ChipGroup options={INCOME_SOURCES} selected={sourceOfIncome} onSelect={(v) => { setSourceOfIncome(v); setErrors((e) => ({ ...e, sourceOfIncome: '' })); }} />
              {errors.sourceOfIncome ? <Text style={styles.fieldError}>{errors.sourceOfIncome}</Text> : null}
            </View>
          )}

          {step === 3 && (
            <View>
              {errors.documents ? (
                <View style={styles.docError}>
                  <Ionicons name="alert-circle" size={15} color={colors.danger} />
                  <Text style={styles.docErrorText}>{errors.documents}</Text>
                </View>
              ) : (
                <View style={styles.docHint}>
                  <Ionicons name="camera-outline" size={15} color={colors.teal} />
                  <Text style={styles.docHintText}>
                    Photos must be clear, complete, and legible. Use landscape orientation and ensure no glare.
                  </Text>
                </View>
              )}
              <AppCard padded={false} style={{ marginBottom: 12 }}>
                {uploads.map((u, i) => (
                  <DocRow
                    key={`${u.documentType}-${i}`}
                    name={u.documentName}
                    type={u.documentType}
                    submitted={u.status === 'DONE'}
                    status={u.status === 'DONE' ? 'PENDING' : undefined}
                    fileName={u.fileName}
                    onPress={() => setPickTarget(u)}
                  />
                ))}
              </AppCard>
              {!allUploaded ? (
                <Text style={styles.docNote}>Tap each document to choose a photo from your gallery.</Text>
              ) : (
                <View style={styles.allDone}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                  <Text style={styles.allDoneText}>All documents uploaded!</Text>
                </View>
              )}
            </View>
          )}

          {step === 4 && (
            <View>
              <AppCard style={{ marginBottom: 12 }}>
                <Text style={styles.reviewSection}>Personal</Text>
                <Text style={styles.reviewLine}>{`${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`}</Text>
                <Text style={styles.reviewLineMuted}>{`${formatLabel('gender', gender)} · ${civilStatus}`}</Text>
                <Text style={styles.reviewLineMuted}>{dateOfBirth}</Text>
              </AppCard>
              <AppCard style={{ marginBottom: 12 }}>
                <Text style={styles.reviewSection}>Address</Text>
                <Text style={styles.reviewLine}>{`${[street, barangay].filter(Boolean).join(', ')}`}</Text>
                <Text style={styles.reviewLineMuted}>{`${city}, ${province}${postalCode ? ' ' + postalCode : ''}`}</Text>
              </AppCard>
              <AppCard style={{ marginBottom: 12 }}>
                <Text style={styles.reviewSection}>Employment / Income</Text>
                <Text style={styles.reviewLine}>{`${occupation} (${employmentStatus || 'N/A'})`}</Text>
                <Text style={styles.reviewLineMuted}>{`${employer ? employer + ' · ' : ''}Monthly income: ₱${Number(monthlyIncome)?.toLocaleString() ?? monthlyIncome}`}</Text>
                <Text style={styles.reviewLineMuted}>Source: {sourceOfIncome || '—'}</Text>
              </AppCard>
              <AppCard padded={false} style={{ marginBottom: 8 }}>
                {uploads.map((u, i) => (
                  <DocRow
                    key={`${u.documentType}-review-${i}`}
                    name={u.documentName}
                    type={u.documentType}
                    submitted={u.status === 'DONE'}
                    status={u.status === 'DONE' ? 'PENDING' : undefined}
                    fileName={u.fileName}
                  />
                ))}
              </AppCard>
              <View style={styles.consentRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.teal} />
                <Text style={styles.consentText}>
                  I certify that the information and documents I provided are true and correct, and I consent to HOSCOMCO's verification process under the Data Privacy Act.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.navRow}>
            {step > 0 ? (
              <TouchableOpacity style={styles.backStepBtn} onPress={back}>
                <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
                <Text style={styles.backStepText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.backStepBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
                <Text style={styles.backStepText}>Cancel</Text>
              </TouchableOpacity>
            )}
            {step < 4 ? (
              <View style={styles.flex1}>
                <AppButton title="Continue" onPress={next} />
              </View>
            ) : (
              <View style={styles.flex1}>
                <AppButton
                  title="Submit for Verification"
                  loading={submitting}
                  onPress={() => setConfirmVisible(true)}
                  icon={<Ionicons name="paper-plane-outline" size={18} color={colors.white} />}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AppModal
        visible={!!pickTarget && mediaPermission !== false}
        onClose={() => setPickTarget(null)}
        title="Upload Document"
        subtitle={pickTarget?.documentName}
        icon="cloud-upload-outline"
        confirmText="Choose Photo"
        onConfirm={() => {
          if (pickTarget) {
            const target = pickTarget;
            setPickTarget(null); // Close this modal FIRST, then launch the picker
            pickFor(target);
          }
        }}
        confirmLoading={false}
      >
        <Text style={styles.modalNote}>
          Select a clear photo of your {pickTarget?.documentName.toLowerCase() ?? 'document'}. The file will be sent securely to the branch for verification.
        </Text>
      </AppModal>

      <AppModal
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        title="Submit KYC for Verification?"
        subtitle="You will not be able to edit this submission while it is under review."
        icon="document-text-outline"
        iconColor={colors.teal}
        iconBg={colors.tealSoft}
        confirmText="Submit Now"
        onConfirm={handleSubmit}
        confirmLoading={submitting}
      >
        <View style={styles.confirmSummary}>
          <View style={styles.confirmLine}>
            <Text style={styles.confirmKey}>Documents</Text>
            <Text style={styles.confirmVal}>{uploads.length} uploaded</Text>
          </View>
          <Text style={styles.modalNote}>
            False or incomplete information may delay approval of your submission.
          </Text>
        </View>
      </AppModal>
    </SafeAreaView>
  );
};

function formatLabel(key: string, v: string) {
  return v || '—';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 4 },
  fieldError: { fontSize: 12, color: colors.danger, fontWeight: '600', marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.round,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginLeft: 6 },
  chipTextActive: { color: colors.white },
  docError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12,
  },
  docErrorText: { flex: 1, marginLeft: 8, fontSize: 12, color: colors.danger, fontWeight: '600' },
  docHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: colors.tealBorder,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12,
  },
  docHintText: { flex: 1, marginLeft: 8, fontSize: 12, color: colors.tealDark, lineHeight: 17 },
  docNote: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 4 },
  allDone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  allDoneText: { fontSize: 13, color: colors.greenDark, fontWeight: '700', marginLeft: 6 },
  reviewSection: { fontSize: 11, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  reviewLine: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },
  reviewLineMuted: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 4, paddingVertical: 8 },
  consentText: { flex: 1, fontSize: 11, color: colors.textMuted, marginLeft: 8, lineHeight: 16 },
  navRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  backStepBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 12, marginRight: 8 },
  backStepText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  flex1: { flex: 1 },
  submitError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12,
  },
  submitErrorText: { flex: 1, marginLeft: 8, fontSize: 12, color: colors.danger, fontWeight: '600' },
  modalNote: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  confirmSummary: { marginTop: 4 },
  confirmLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  confirmKey: { fontSize: 13, color: colors.textMuted },
  confirmVal: { fontSize: 13, fontWeight: '700', color: colors.text },
  successWrap: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  successMsg: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  receiptCard: { alignSelf: 'stretch', marginTop: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  metaLabel: { fontSize: 12, color: colors.textMuted },
  metaValue: { fontSize: 12, fontWeight: '700', color: colors.text },
  homeLink: { paddingVertical: 12, marginTop: 6 },
  homeLinkText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
});