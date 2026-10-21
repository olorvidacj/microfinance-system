import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, AppTextInput, ErrorView, LoadingView, ScreenHeader, SelectField, WizardHeader, type SelectOption } from '../../components';
import { colors, radius } from '../../theme';
import { ApiError, api, messageOf } from '../../services/api';
import {
  buildKycApplication,
  kycFormErrors,
  kycFormFrom,
  kycStepsValid,
  manilaToday,
  type FaceMatchResultView,
  type IdScanView,
  type KycFormState,
  type KycStatusView,
  type PsgcPlaceView,
} from '../../shared/client';
import { CIVIL_STATUSES, EMPLOYMENT_STATUSES, GENDERS, ID_TYPES, SOURCES_OF_INCOME, findIdType, type KycStep } from '../../shared/kyc';
import { pickImage } from '../../utils/pickImage';
import type { HomeStackParamList } from '../../navigation/types';

const STEPS = [
  { title: 'Government ID', subtitle: 'Photo of your valid ID' },
  { title: 'Selfie', subtitle: 'Matched against your ID photo' },
  { title: 'Personal details', subtitle: 'As printed on your ID' },
  { title: 'Address', subtitle: 'Where you live now' },
  { title: 'Livelihood & income', subtitle: 'Work and monthly income' },
  { title: 'Documents', subtitle: 'Supporting proofs' },
  { title: 'Review & consent', subtitle: 'Check and submit' },
];

/** Which of the server's checks (validateKycApplication) belong to each step. */
const STEP_CHECKS: Record<number, KycStep[]> = { 0: ['ID_UPLOAD'], 2: ['PERSONAL_INFO', 'CONTACT'], 3: ['ADDRESS'], 4: ['FINANCIAL'], 6: ['CONSENT'] };
/** Server requiredStep -> step index. */
const STEP_INDEX: Record<string, number> = { ID_UPLOAD: 0, FACE_MATCH: 1, PERSONAL_INFO: 2, CONTACT: 2, ADDRESS: 3, FINANCIAL: 4, DOCUMENTS: 5, CONSENT: 6 };
/** Documents captured by the ID and selfie steps; the rest are uploaded in step 6. */
const CAPTURED_KINDS = ['ID_FRONT', 'ID_BACK', 'SELFIE'];
const EMPLOYED = ['Employed', 'Government Employee', 'Private Employee', 'OFW'];
const BUSINESS = ['Self-Employed', 'Business Owner'];

type Errors = Partial<Record<keyof KycFormState | 'scan' | 'face' | 'documents' | 'submit', string>>;

/** The member's KYC application: same steps, payload and checks as the web portal (shared/client/kycForm.ts). */
export const KycFormScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [status, setStatus] = useState<KycStatusView | null>(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<KycFormState | null>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  const [scan, setScan] = useState<IdScanView | null>(null);
  const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
  const [idBackDone, setIdBackDone] = useState(false);
  const [face, setFace] = useState<FaceMatchResultView | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ referenceNumber: string; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api.getKycStatus();
      setStatus(s);
      setForm(kycFormFrom(s));
      setLoadError('');
    } catch (err) {
      setLoadError(messageOf(err, 'Your KYC application could not be loaded.'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onFile = useCallback((kind: string) => status?.requiredDocuments.find((d) => d.type === kind && d.submitted) ?? null, [status]);
  const idType = form ? findIdType(form.idType) : undefined;
  const idFrontStored = Boolean(scan || onFile('ID_FRONT'));
  const scanUnreadable = scan?.validation.status === 'COMPLETED' && scan.validation.isReadable === false;
  const selfieStored = Boolean(face || onFile('SELFIE'));
  const supporting = (status?.requiredDocuments ?? []).filter((d) => !CAPTURED_KINDS.includes(d.type));

  const set = <K extends keyof KycFormState>(key: K, value: KycFormState[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // ---- step checks: the server's own rules plus what each step captures ----
  const stepErrors = (i: number, f: KycFormState): Errors => {
    const e: Errors = STEP_CHECKS[i] ? kycFormErrors(f, STEP_CHECKS[i], manilaToday()) : {};
    if (i === 0) {
      if (!idFrontStored) e.scan = 'Take a photo of the front of your ID.';
      else if (scanUnreadable) e.scan = 'Your ID could not be read. Please retake the photo.';
      if (idType?.hasBackSide && !idBackDone && !onFile('ID_BACK')) e.scan = e.scan ?? 'Take a photo of the back of your ID too.';
    }
    if (i === 1) {
      if (!selfieStored) e.face = 'Take a selfie to continue.';
      else if (face?.matchStatus === 'NO_MATCH') e.face = 'Your selfie does not match your ID photo. Please retake it in good light.';
    }
    if (i === 5) {
      const missing = supporting.filter((d) => !d.submitted && !uploaded[d.type]);
      if (missing.length) e.documents = `Upload: ${missing.map((d) => d.name).join(', ')}.`;
    }
    return e;
  };

  const next = () => {
    if (!form) return;
    const e = stepErrors(step, form);
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  // ---- ID and selfie ----
  const scanId = async (source: 'camera' | 'library') => {
    setErrors((e) => ({ ...e, scan: undefined }));
    try {
      const photo = await pickImage(source);
      if (!photo) return;
      setBusy('scan');
      const result = await api.processKycId({ frontImageBase64: photo.dataUrl, fileName: photo.fileName });
      setScan(result);
      setIdFrontUri(photo.uri);
      const x = result.extractedData;
      if (x && result.validation.isReadable !== false) {
        setForm((f) =>
          f
            ? {
                ...f,
                firstName: x.firstName || f.firstName,
                middleName: x.middleName || f.middleName,
                lastName: x.lastName || f.lastName,
                dateOfBirth: x.dateOfBirth || f.dateOfBirth,
                idDateOfBirth: x.dateOfBirth || f.idDateOfBirth,
                gender: x.gender && (GENDERS as readonly string[]).includes(x.gender) ? x.gender : f.gender,
                idNumber: x.idNumber || f.idNumber,
                nameOnId: x.fullName || f.nameOnId,
                idIssueDate: x.issueDate || f.idIssueDate,
                idExpiryDate: x.expirationDate || f.idExpiryDate,
              }
            : f,
        );
      }
    } catch (err) {
      setErrors((e) => ({ ...e, scan: messageOf(err, 'Your ID could not be uploaded.') }));
    } finally {
      setBusy('');
    }
  };

  const uploadIdBack = async (source: 'camera' | 'library') => {
    try {
      const photo = await pickImage(source);
      if (!photo) return;
      setBusy('back');
      await api.uploadKycDocument({ documentType: 'ID_FRONT', side: 'BACK', documentName: 'Government ID (back)', fileName: photo.fileName, imageBase64: photo.dataUrl });
      setIdBackDone(true);
      setErrors((e) => ({ ...e, scan: undefined }));
    } catch (err) {
      setErrors((e) => ({ ...e, scan: messageOf(err, 'The back of your ID could not be uploaded.') }));
    } finally {
      setBusy('');
    }
  };

  const takeSelfie = async () => {
    setErrors((e) => ({ ...e, face: undefined }));
    try {
      const photo = await pickImage('camera', { front: true });
      if (!photo) return;
      setBusy('face');
      const result = await api.matchKycFace(photo.dataUrl);
      setSelfieUri(photo.uri);
      setFace(result.matchResult);
    } catch (err) {
      setErrors((e) => ({ ...e, face: messageOf(err, 'Your selfie could not be checked.') }));
    } finally {
      setBusy('');
    }
  };

  const uploadSupporting = async (kind: string, name: string) => {
    try {
      const photo = await pickImage('library');
      if (!photo) return;
      setBusy(kind);
      const res = await api.uploadKycDocument({ documentType: kind, documentName: name, fileName: photo.fileName, imageBase64: photo.dataUrl });
      setUploaded((u) => ({ ...u, [kind]: res.document.fileName ?? photo.fileName }));
      setErrors((e) => ({ ...e, documents: undefined }));
    } catch (err) {
      setErrors((e) => ({ ...e, documents: messageOf(err, 'The document could not be uploaded.') }));
    } finally {
      setBusy('');
    }
  };

  // ---- save and submit ----
  const saveDraft = async () => {
    if (!form) return;
    setBusy('draft');
    setNotice('');
    try {
      await api.saveKycDraft({ ...buildKycApplication(form), currentStep: step });
      setNotice('Your progress is saved. You can finish later.');
    } catch (err) {
      setErrors((e) => ({ ...e, submit: messageOf(err, 'Your progress could not be saved.') }));
    } finally {
      setBusy('');
    }
  };

  const submit = async () => {
    if (!form) return;
    for (let i = 0; i < STEPS.length; i++) {
      const e = stepErrors(i, form);
      if (Object.values(e).some(Boolean)) {
        setErrors(e);
        setStep(i);
        return;
      }
    }
    setBusy('submit');
    try {
      const res = await api.submitKyc(buildKycApplication(form));
      setDone({ referenceNumber: res.referenceNumber, message: res.message });
    } catch (err) {
      setErrors({ submit: messageOf(err, 'Your application could not be submitted.') });
      const target = err instanceof ApiError ? STEP_INDEX[String(err.details.requiredStep ?? '')] : undefined;
      if (target !== undefined) setStep(target);
    } finally {
      setBusy('');
    }
  };

  // ---- render ----
  if (loadError && !status) return <SafeAreaView style={styles.safe}><ScreenHeader title="Complete KYC" /><ErrorView message={loadError} onRetry={load} /></SafeAreaView>;
  if (!status || !form) return <SafeAreaView style={styles.safe}><ScreenHeader title="Complete KYC" /><LoadingView text="Loading your application…" /></SafeAreaView>;

  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={34} color={colors.white} />
          </View>
          <Text style={styles.successTitle}>Submitted for review</Text>
          <Text style={styles.successMsg}>{done.message}</Text>
          <Text style={styles.successRef}>Reference {done.referenceNumber}</Text>
          <AppButton title="View KYC status" onPress={() => navigation.navigate('KycStatus')} style={{ marginTop: 20, alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!status.editable) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Complete KYC" />
        <View style={styles.successWrap}>
          <Text style={styles.successTitle}>{status.statusLabel}</Text>
          <Text style={styles.successMsg}>Your application cannot be changed right now.</Text>
          <AppButton title="View KYC status" onPress={() => navigation.navigate('KycStatus')} style={{ marginTop: 20, alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Complete KYC" subtitle={status.correctionReason ? `Branch note: ${status.correctionReason}` : undefined} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <WizardHeader steps={STEPS} current={step} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {errors.submit ? <Text style={styles.errorBanner}>{errors.submit}</Text> : null}

          {step === 0 ? (
            <AppCard>
              <Label text="ID type" />
              <Chips options={ID_TYPES.map((t) => t.label)} selected={idType?.label ?? ''} onSelect={(label) => set('idType', ID_TYPES.find((t) => t.label === label)?.code ?? form.idType)} />
              <Text style={styles.hint}>Take a clear photo of the whole card in good light, without glare.</Text>
              {idFrontUri ? <Image source={{ uri: idFrontUri }} style={styles.preview} resizeMode="contain" /> : null}
              <PhotoButtons busy={busy === 'scan'} label={idFrontStored ? 'Retake front of ID' : 'Front of ID'} onPick={scanId} />
              {scan ? (
                <View style={[styles.result, scanUnreadable ? styles.resultBad : styles.resultOk]}>
                  <Text style={styles.resultText}>{scan.validation.qualityMessage}</Text>
                  {scan.validation.validationWarnings.map((w) => <Text key={w} style={styles.resultSub}>• {w}</Text>)}
                </View>
              ) : onFile('ID_FRONT') ? (
                <Text style={styles.hint}>An ID photo is already on file.</Text>
              ) : null}
              {idType?.hasBackSide ? (
                <>
                  <PhotoButtons busy={busy === 'back'} label={idBackDone || onFile('ID_BACK') ? 'Retake back of ID' : 'Back of ID'} onPick={uploadIdBack} />
                  {idBackDone || onFile('ID_BACK') ? <Text style={styles.hint}>Back of ID uploaded.</Text> : null}
                </>
              ) : null}
              {errors.scan ? <Text style={styles.fieldError}>{errors.scan}</Text> : null}
              <AppTextInput label="ID number" value={form.idNumber} onChangeText={(v) => set('idNumber', v)} autoCapitalize="characters" hint={idType ? `e.g. ${idType.example}` : undefined} error={errors.idNumber} />
              <AppTextInput label="Name exactly as printed on the ID" value={form.nameOnId} onChangeText={(v) => set('nameOnId', v)} error={errors.nameOnId} />
              <AppTextInput label="Expiry date (YYYY-MM-DD, if any)" value={form.idExpiryDate} onChangeText={(v) => set('idExpiryDate', v)} keyboardType="numbers-and-punctuation" error={errors.idExpiryDate} />
            </AppCard>
          ) : null}

          {step === 1 ? (
            <AppCard>
              <Text style={styles.hint}>Face the camera in good light, without a cap or sunglasses. Your selfie is compared with your ID photo.</Text>
              {selfieUri ? <Image source={{ uri: selfieUri }} style={styles.preview} resizeMode="contain" /> : null}
              <AppButton title={selfieStored ? 'Retake selfie' : 'Take selfie'} loading={busy === 'face'} onPress={takeSelfie} icon={<Ionicons name="camera-outline" size={18} color={colors.white} />} />
              {face ? (
                <View style={[styles.result, face.matchStatus === 'NO_MATCH' ? styles.resultBad : styles.resultOk]}>
                  <Text style={styles.resultText}>
                    {face.matchStatus === 'MATCH'
                      ? `Your selfie matches your ID${face.matchConfidence !== null ? ` (${face.matchConfidence}%)` : ''}.`
                      : face.matchStatus === 'NO_MATCH'
                        ? 'Your selfie does not match your ID photo.'
                        : face.details ?? 'A branch officer will compare your selfie with your ID.'}
                  </Text>
                </View>
              ) : onFile('SELFIE') ? (
                <Text style={styles.hint}>A selfie is already on file.</Text>
              ) : null}
              {errors.face ? <Text style={styles.fieldError}>{errors.face}</Text> : null}
            </AppCard>
          ) : null}

          {step === 2 ? (
            <AppCard>
              <AppTextInput label="First name" value={form.firstName} onChangeText={(v) => set('firstName', v)} error={errors.firstName} />
              {!form.hasNoMiddleName ? <AppTextInput label="Middle name" value={form.middleName} onChangeText={(v) => set('middleName', v)} error={errors.middleName} /> : null}
              <Toggle label="I have no middle name" value={form.hasNoMiddleName} onChange={(v) => set('hasNoMiddleName', v)} />
              <AppTextInput label="Last name" value={form.lastName} onChangeText={(v) => set('lastName', v)} error={errors.lastName} />
              <AppTextInput label="Suffix (Jr., III…)" value={form.suffix} onChangeText={(v) => set('suffix', v)} />
              <AppTextInput label="Date of birth (YYYY-MM-DD)" value={form.dateOfBirth} onChangeText={(v) => { set('dateOfBirth', v); set('idDateOfBirth', v); }} keyboardType="numbers-and-punctuation" error={errors.dateOfBirth} />
              <AppTextInput label="Place of birth" value={form.placeOfBirth} onChangeText={(v) => set('placeOfBirth', v)} error={errors.placeOfBirth} />
              <Label text="Sex" />
              <Chips options={GENDERS} selected={form.gender} onSelect={(v) => set('gender', v)} error={errors.gender} />
              <Label text="Civil status" />
              <Chips options={CIVIL_STATUSES} selected={form.civilStatus} onSelect={(v) => set('civilStatus', v)} error={errors.civilStatus} />
              <AppTextInput label="Nationality" value={form.nationality} onChangeText={(v) => set('nationality', v)} error={errors.nationality} />
              <AppTextInput label="Mobile number" value={form.mobileNumber} onChangeText={(v) => set('mobileNumber', v)} keyboardType="phone-pad" error={errors.mobileNumber} />
              <AppTextInput label="Email" value={form.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
              <AppTextInput label="Emergency contact name" value={form.emergencyContactName} onChangeText={(v) => set('emergencyContactName', v)} />
              <AppTextInput label="Relationship" value={form.emergencyContactRelationship} onChangeText={(v) => set('emergencyContactRelationship', v)} />
            </AppCard>
          ) : null}

          {step === 3 ? (
            <>
              <AppCard style={{ marginBottom: 12 }}>
                <Text style={styles.cardTitle}>Current address</Text>
                <AddressFields form={form} prefix="current" set={set} errors={errors} />
                <Toggle label="My permanent address is the same" value={form.isPermanentSameAsCurrent} onChange={(v) => set('isPermanentSameAsCurrent', v)} />
              </AppCard>
              {!form.isPermanentSameAsCurrent ? (
                <AppCard>
                  <Text style={styles.cardTitle}>Permanent address</Text>
                  <AddressFields form={form} prefix="perm" set={set} errors={errors} />
                </AppCard>
              ) : null}
            </>
          ) : null}

          {step === 4 ? (
            <AppCard>
              <Label text="Employment status" />
              <Chips options={EMPLOYMENT_STATUSES} selected={form.employmentStatus} onSelect={(v) => set('employmentStatus', v)} error={errors.employmentStatus} />
              {form.employmentStatus === 'Other' ? <AppTextInput label="Please explain" value={form.otherStatusExplanation} onChangeText={(v) => set('otherStatusExplanation', v)} error={errors.otherStatusExplanation} /> : null}
              {EMPLOYED.includes(form.employmentStatus) ? (
                <>
                  <AppTextInput label="Employer name" value={form.employerName} onChangeText={(v) => set('employerName', v)} error={errors.employerName} />
                  <AppTextInput label="Position" value={form.jobPosition} onChangeText={(v) => set('jobPosition', v)} />
                </>
              ) : null}
              {BUSINESS.includes(form.employmentStatus) ? (
                <>
                  <AppTextInput label="Business name" value={form.businessName} onChangeText={(v) => set('businessName', v)} error={errors.businessName} />
                  <AppTextInput label="Nature of business" value={form.natureOfBusiness} onChangeText={(v) => set('natureOfBusiness', v)} />
                </>
              ) : null}
              <AppTextInput label="Monthly income (₱)" value={form.monthlyIncome} onChangeText={(v) => set('monthlyIncome', v)} keyboardType="decimal-pad" error={errors.monthlyIncome} />
              <AppTextInput label="Monthly expenses (₱)" value={form.monthlyExpenses} onChangeText={(v) => set('monthlyExpenses', v)} keyboardType="decimal-pad" error={errors.monthlyExpenses} />
              <Label text="Main source of income" />
              <Chips options={SOURCES_OF_INCOME} selected={form.sourceOfIncome} onSelect={(v) => set('sourceOfIncome', v)} error={errors.sourceOfIncome} />
            </AppCard>
          ) : null}

          {step === 5 ? (
            <AppCard>
              {supporting.length === 0 ? <Text style={styles.hint}>No other documents are required.</Text> : null}
              {supporting.map((d) => {
                const have = uploaded[d.type] ?? (d.submitted ? d.fileName ?? 'On file' : null);
                return (
                  <View key={d.type} style={styles.docRow}>
                    <Ionicons name={have ? 'checkmark-circle' : 'document-outline'} size={20} color={have ? colors.green : colors.textMuted} />
                    <View style={styles.flex1}>
                      <Text style={styles.docName}>{d.name}</Text>
                      <Text style={styles.hint}>{have ?? 'Not uploaded yet'}</Text>
                    </View>
                    <AppButton title={have ? 'Replace' : 'Upload'} size="sm" variant="outline" loading={busy === d.type} onPress={() => uploadSupporting(d.type, d.name)} />
                  </View>
                );
              })}
              {errors.documents ? <Text style={styles.fieldError}>{errors.documents}</Text> : null}
            </AppCard>
          ) : null}

          {step === 6 ? (
            <AppCard>
              <Text style={styles.cardTitle}>Please confirm</Text>
              <Summary label="Name" value={[form.firstName, form.hasNoMiddleName ? '' : form.middleName, form.lastName, form.suffix].filter(Boolean).join(' ')} />
              <Summary label="Born" value={`${form.dateOfBirth} · ${form.placeOfBirth}`} />
              <Summary label="ID" value={`${idType?.label ?? form.idType} · ${form.idNumber}`} />
              <Summary label="Address" value={[form.currentHouseNumber, form.currentStreet, form.currentBarangayName, form.currentCityName, form.currentProvinceName].filter(Boolean).join(', ')} />
              <Summary label="Income" value={`₱${form.monthlyIncome} a month · ${form.sourceOfIncome}`} />
              <View style={{ height: 12 }} />
              <Consent label="The information I gave is true and correct." value={form.truthfulInformation} onChange={(v) => set('truthfulInformation', v)} error={errors.truthfulInformation} />
              <Consent label="The documents I uploaded are mine and genuine." value={form.documentOwnership} onChange={(v) => set('documentOwnership', v)} error={errors.documentOwnership} />
              <Consent label="I allow HOSCOMCO to review and verify my information." value={form.authorizedReview} onChange={(v) => set('authorizedReview', v)} />
              <Consent label="I have read and accept the Data Privacy Notice (RA 10173)." value={form.privacyNotice} onChange={(v) => set('privacyNotice', v)} error={errors.privacyNotice} />
              <Consent label="I understand that false statements may lead to rejection and legal action." value={form.penaltyAcknowledgment} onChange={(v) => set('penaltyAcknowledgment', v)} />
            </AppCard>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 ? <AppButton title="Back" variant="outline" onPress={() => { setErrors({}); setStep((s) => s - 1); }} style={styles.footerBtn} /> : null}
          <AppButton title="Save" variant="secondary" loading={busy === 'draft'} onPress={saveDraft} style={styles.footerBtn} />
          {step < STEPS.length - 1 ? (
            <AppButton title="Next" onPress={next} style={styles.footerBtnWide} disabled={busy !== '' && busy !== 'draft'} />
          ) : (
            <AppButton title="Submit" onPress={submit} loading={busy === 'submit'} style={styles.footerBtnWide} disabled={!kycStepsValid(form, ['CONSENT'], manilaToday())} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------

type SetField = <K extends keyof KycFormState>(key: K, value: KycFormState[K]) => void;

/** Form fields that hold text. */
type TextField = { [K in keyof KycFormState]: KycFormState[K] extends string ? K : never }[keyof KycFormState];
type AddressPart = 'RegionCode' | 'RegionName' | 'ProvinceCode' | 'ProvinceName' | 'CityCode' | 'CityName' | 'BarangayCode' | 'BarangayName' | 'PostalCode' | 'HouseNumber' | 'Street' | 'Subdivision' | 'Landmark';

const ADDRESS_FIELDS: Record<'current' | 'perm', Record<AddressPart, TextField>> = {
  current: {
    RegionCode: 'currentRegionCode', RegionName: 'currentRegionName', ProvinceCode: 'currentProvinceCode', ProvinceName: 'currentProvinceName',
    CityCode: 'currentCityCode', CityName: 'currentCityName', BarangayCode: 'currentBarangayCode', BarangayName: 'currentBarangayName',
    PostalCode: 'currentPostalCode', HouseNumber: 'currentHouseNumber', Street: 'currentStreet', Subdivision: 'currentSubdivision', Landmark: 'currentLandmark',
  },
  perm: {
    RegionCode: 'permRegionCode', RegionName: 'permRegionName', ProvinceCode: 'permProvinceCode', ProvinceName: 'permProvinceName',
    CityCode: 'permCityCode', CityName: 'permCityName', BarangayCode: 'permBarangayCode', BarangayName: 'permBarangayName',
    PostalCode: 'permPostalCode', HouseNumber: 'permHouseNumber', Street: 'permStreet', Subdivision: 'permSubdivision', Landmark: 'permLandmark',
  },
};

const LEVELS = ['Region', 'Province', 'City', 'Barangay'] as const;
type Level = (typeof LEVELS)[number];

/** Region → province → city → barangay from the PSGC lists, then street details. */
const AddressFields: React.FC<{ form: KycFormState; prefix: 'current' | 'perm'; set: SetField; errors: Errors }> = ({ form, prefix, set, errors }) => {
  const f = ADDRESS_FIELDS[prefix];
  const get = (part: AddressPart) => form[f[part]];
  const put = (part: AddressPart, value: string) => set(f[part], value);
  const regionCode = get('RegionCode');
  const provinceCode = get('ProvinceCode');
  const cityCode = get('CityCode');
  const [regions, setRegions] = useState<PsgcPlaceView[]>([]);
  const [provinces, setProvinces] = useState<PsgcPlaceView[]>([]);
  const [cities, setCities] = useState<PsgcPlaceView[]>([]);
  const [barangays, setBarangays] = useState<PsgcPlaceView[]>([]);
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState('');

  const fetchList = useCallback(async (what: string, run: () => Promise<PsgcPlaceView[]>, store: (v: PsgcPlaceView[]) => void) => {
    setLoading(what);
    try {
      store(await run());
      setListError('');
    } catch (err) {
      setListError(messageOf(err, 'The address lists could not be loaded.'));
    } finally {
      setLoading('');
    }
  }, []);

  useEffect(() => {
    fetchList('regions', () => api.getRegions(), setRegions);
  }, [fetchList]);
  useEffect(() => {
    if (regionCode) fetchList('provinces', () => api.getProvinces(regionCode), setProvinces);
  }, [regionCode, fetchList]);
  useEffect(() => {
    if (regionCode) fetchList('cities', () => api.getCities(regionCode, provinceCode || undefined), setCities);
  }, [regionCode, provinceCode, fetchList]);
  useEffect(() => {
    if (cityCode) fetchList('barangays', () => api.getBarangays(cityCode), setBarangays);
  }, [cityCode, fetchList]);

  const choose = async (level: Level, o: SelectOption) => {
    put(`${level}Code`, o.code);
    put(`${level}Name`, o.name);
    // A new choice clears everything below it.
    for (const below of LEVELS.slice(LEVELS.indexOf(level) + 1)) {
      put(`${below}Code`, '');
      put(`${below}Name`, '');
    }
    if (level === 'City' || level === 'Barangay') {
      try {
        const zip = await api.getPostalCode(level === 'City' ? o.code : cityCode, level === 'Barangay' ? o.code : undefined);
        if (zip) put('PostalCode', zip);
      } catch (err) {
        setListError(messageOf(err, 'The ZIP code could not be looked up; please type it.'));
      }
    }
  };

  const err = (part: AddressPart) => errors[f[part]];
  return (
    <>
      {listError ? <Text style={styles.fieldError}>{listError}</Text> : null}
      <SelectField label="Region" value={get('RegionName')} options={regions} onSelect={(o) => choose('Region', o)} loading={loading === 'regions'} error={err('RegionCode')} />
      {provinces.length ? <SelectField label="Province" value={get('ProvinceName')} options={provinces} onSelect={(o) => choose('Province', o)} disabled={!regionCode} loading={loading === 'provinces'} /> : null}
      <SelectField label="City / municipality" value={get('CityName')} options={cities} onSelect={(o) => choose('City', o)} disabled={!regionCode} loading={loading === 'cities'} error={err('CityCode')} />
      <SelectField label="Barangay" value={get('BarangayName')} options={barangays} onSelect={(o) => choose('Barangay', o)} disabled={!cityCode} loading={loading === 'barangays'} error={err('BarangayCode')} />
      <AppTextInput label="ZIP code" value={get('PostalCode')} onChangeText={(v) => put('PostalCode', v)} keyboardType="number-pad" maxLength={4} error={err('PostalCode')} />
      <AppTextInput label="House / unit no." value={get('HouseNumber')} onChangeText={(v) => put('HouseNumber', v)} />
      <AppTextInput label="Street" value={get('Street')} onChangeText={(v) => put('Street', v)} error={err('Street')} />
      <AppTextInput label="Subdivision / village" value={get('Subdivision')} onChangeText={(v) => put('Subdivision', v)} />
      <AppTextInput label="Landmark" value={get('Landmark')} onChangeText={(v) => put('Landmark', v)} />
    </>
  );
};

const Label: React.FC<{ text: string }> = ({ text }) => <Text style={styles.label}>{text}</Text>;

const Chips: React.FC<{ options: readonly string[]; selected: string; onSelect: (v: string) => void; error?: string }> = ({ options, selected, onSelect, error }) => (
  <View style={{ marginBottom: 10 }}>
    <View style={styles.chipRow}>
      {options.map((o) => (
        <TouchableOpacity key={o} style={[styles.chip, selected === o && styles.chipActive]} onPress={() => onSelect(o)} accessibilityLabel={o}>
          <Text style={[styles.chipText, selected === o && styles.chipTextActive]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
  </View>
);

const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
  <View style={styles.toggleRow}>
    <Text style={styles.toggleText}>{label}</Text>
    <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.teal, false: colors.border }} accessibilityLabel={label} />
  </View>
);

const Consent: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void; error?: string }> = ({ label, value, onChange, error }) => (
  <TouchableOpacity style={styles.consentRow} onPress={() => onChange(!value)} accessibilityRole="checkbox" accessibilityState={{ checked: value }} accessibilityLabel={label}>
    <Ionicons name={value ? 'checkbox' : 'square-outline'} size={22} color={error ? colors.danger : value ? colors.primary : colors.textMuted} />
    <Text style={styles.consentText}>{label}</Text>
  </TouchableOpacity>
);

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value || '—'}</Text>
  </View>
);

const PhotoButtons: React.FC<{ label: string; busy: boolean; onPick: (source: 'camera' | 'library') => void }> = ({ label, busy, onPick }) => (
  <View style={styles.photoRow}>
    <AppButton title={`${label}: camera`} size="sm" loading={busy} onPress={() => onPick('camera')} style={styles.photoBtn} />
    <AppButton title="Gallery" size="sm" variant="outline" disabled={busy} onPress={() => onPick('library')} style={styles.photoBtn} />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  notice: { backgroundColor: colors.greenSoft, color: colors.greenDark, padding: 10, borderRadius: radius.md, marginBottom: 12, fontSize: 13 },
  errorBanner: { backgroundColor: colors.dangerSoft, color: colors.danger, padding: 10, borderRadius: radius.md, marginBottom: 12, fontSize: 13 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 4 },
  hint: { fontSize: 12, color: colors.textMuted, marginVertical: 6, lineHeight: 17 },
  fieldError: { fontSize: 12, color: colors.danger, marginVertical: 4 },
  preview: { width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.borderLight, marginVertical: 8 },
  result: { borderRadius: radius.md, padding: 10, marginVertical: 8 },
  resultOk: { backgroundColor: colors.greenSoft },
  resultBad: { backgroundColor: colors.dangerSoft },
  resultText: { fontSize: 12, color: colors.text, lineHeight: 17 },
  resultSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  photoRow: { flexDirection: 'row', marginVertical: 6 },
  photoBtn: { flex: 1, marginRight: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.round, borderWidth: 1, borderColor: colors.border, marginRight: 6, marginBottom: 6, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  toggleText: { flex: 1, fontSize: 13, color: colors.textSecondary, marginRight: 8 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  consentText: { flex: 1, fontSize: 13, color: colors.text, marginLeft: 10, lineHeight: 19 },
  summaryRow: { flexDirection: 'row', paddingVertical: 5 },
  summaryLabel: { width: 80, fontSize: 12, color: colors.textMuted },
  summaryValue: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '600' },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  flex1: { flex: 1, marginHorizontal: 10 },
  docName: { fontSize: 14, fontWeight: '700', color: colors.text },
  footer: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  footerBtn: { flex: 1, marginRight: 8 },
  footerBtnWide: { flex: 1.4 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center' },
  successMsg: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  successRef: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 10 },
});
