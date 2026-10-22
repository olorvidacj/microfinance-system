import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppCard, AppTextInput, ErrorView, GuidedCamera, LoadingView, ScreenHeader, SelectField, WizardHeader, type SelectOption } from '../../components';
import { colors, radius } from '../../theme';
import { ApiError, api, messageOf } from '../../services/api';
import {
  IDENTITY_DOCUMENT_KINDS,
  KYC_WIZARD_STEPS,
  buildKycApplication,
  faceResultForMember,
  kycCanEdit,
  kycFormErrors,
  kycFormFrom,
  kycIssuesFrom,
  kycRequestedSections,
  kycStepLocked,
  kycStepOfIssue,
  kycStepsValid,
  manilaToday,
  type KycFormState,
  type KycStatusFullView,
  type PsgcPlaceView,
} from '../../shared/client';
import {
  CIVIL_STATUSES,
  EMPLOYMENT_STATUSES,
  GENDERS,
  ID_TYPES,
  KYC_SECTION_LABELS,
  SOURCES_OF_INCOME,
  findIdType,
  parseSections,
  scopeApplication,
  sectionOpen,
  type KycSection,
} from '../../shared/kyc';
import { pickImage, type PickedImage } from '../../utils/pickImage';
import type { HomeStackParamList } from '../../navigation/types';

const STEPS = [...KYC_WIZARD_STEPS];
const EMPLOYED = ['Employed', 'Government Employee', 'Private Employee', 'OFW'];
const BUSINESS = ['Self-Employed', 'Business Owner'];
const ID_TIPS = ['Place the ID on a plain, dark surface.', 'Use good light and avoid glare on the card.', 'Keep all four corners inside the frame.'];
const SELFIE_TIPS = ['Face a window or a light.', 'Remove glasses, a cap or a mask.', 'Keep your whole face inside the oval.'];

type Errors = Partial<Record<keyof KycFormState | 'scan' | 'face' | 'documents' | 'submit', string>>;
type CaptureKind = 'ID_FRONT' | 'ID_BACK' | 'SELFIE';

const stored = (s: KycStatusFullView, kind: string) => s.requiredDocuments.find((d) => d.type === kind && d.submitted) ?? null;

/** What a step still needs, by the server's own rules (shared) plus the photos and checks it captures. */
function missing(i: number, f: KycFormState, s: KycStatusFullView, today: string): Errors {
  const step = STEPS[i];
  const e: Errors = step.checks.length ? kycFormErrors(f, step.checks, today) : {};
  if (step.key === 'id') {
    if (!stored(s, 'ID_FRONT')) e.scan = 'Take a photo of the front of your ID.';
    else if (s.requiredDocuments.some((d) => d.type === 'ID_BACK') && !stored(s, 'ID_BACK')) e.scan = 'Take a photo of the back of your ID too.';
    else if (!s.extractedIdData) e.scan = 'Read your ID before you continue.';
  }
  if (step.key === 'selfie' && !e.biometricConsent) {
    if (!stored(s, 'SELFIE')) e.face = 'Take a selfie to continue.';
    else if (!s.faceMatchResult) e.face = 'Compare your selfie with your ID to continue.';
  }
  if (step.key === 'more') {
    const left = s.requiredDocuments.filter((d) => !IDENTITY_DOCUMENT_KINDS.includes(d.type) && !d.submitted);
    if (left.length) e.documents = `Upload: ${left.map((d) => d.name).join(', ')}.`;
  }
  return e;
}

const hasErrors = (e: Errors) => Object.values(e).some(Boolean);

/** The member's KYC application: the same six steps, payload and checks as the web portal (shared/client). */
export const KycFormScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const today = manilaToday();
  const [status, setStatus] = useState<KycStatusFullView | null>(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<KycFormState | null>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [readMessage, setReadMessage] = useState('');
  const [camera, setCamera] = useState<CaptureKind | null>(null);
  const [done, setDone] = useState<{ referenceNumber: string; message: string } | null>(null);
  const formRef = useRef<KycFormState | null>(null);
  formRef.current = form;

  const load = useCallback(async () => {
    try {
      const s = await api.getKycStatus();
      const f = kycFormFrom(s);
      setStatus(s);
      setForm(f);
      setLoadError('');
      // Resume at the first unfinished step (or the first part staff asked to change).
      const requested = kycRequestedSections(s);
      const d = manilaToday();
      const at = STEPS.findIndex((st, i) => i < STEPS.length - 1 && !kycStepLocked(st, requested) && (requested !== null || hasErrors(missing(i, f, s, d))));
      setStep(at >= 0 ? at : STEPS.length - 1);
    } catch (err) {
      setLoadError(messageOf(err, 'Your KYC application could not be loaded.'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async (): Promise<KycStatusFullView | null> => {
    try {
      const s = await api.getKycStatus();
      setStatus(s);
      return s;
    } catch (err) {
      setErrors((e) => ({ ...e, submit: messageOf(err, 'Your latest status could not be loaded.') }));
      return null;
    }
  };

  const set = <K extends keyof KycFormState>(key: K, value: KycFormState[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => ({ ...e, [key]: undefined, submit: undefined }));
  };

  const requested = kycRequestedSections(status);
  const open = (section: KycSection) => sectionOpen(section, requested);
  const payload = (f: KycFormState) => scopeApplication(buildKycApplication(f), requested);

  /** Saves what may be changed now. */
  const save = async (): Promise<boolean> => {
    const f = formRef.current;
    if (!f) return false;
    try {
      await api.saveKycDraft({ ...payload(f), currentStep: step + 1 });
      return true;
    } catch (err) {
      setErrors((e) => ({ ...e, submit: messageOf(err, 'Your progress could not be saved.') }));
      return false;
    }
  };

  // ---- photos: ID sides, selfie, supporting documents ----
  const handlePhoto = async (kind: string, name: string, photo: PickedImage) => {
    setBusy(kind);
    setErrors((e) => ({ ...e, scan: undefined, face: undefined, documents: undefined }));
    try {
      if (kind === 'SELFIE') {
        // The server compares only with the consent it has on record.
        if (!(await save())) return;
        await api.matchKycFace(photo.dataUrl);
        await refresh();
        return;
      }
      if (kind === 'ID_FRONT' || kind === 'ID_BACK') {
        // The chosen ID type decides whether the back is needed; the server must have it first.
        if (!(await save())) return;
        await api.uploadKycDocument({ documentType: kind, documentName: name, fileName: photo.fileName, imageBase64: photo.dataUrl });
        const s = await refresh();
        if (s && stored(s, 'ID_FRONT') && (!s.requiredDocuments.some((d) => d.type === 'ID_BACK') || stored(s, 'ID_BACK'))) await readId();
        return;
      }
      await api.uploadKycDocument({ documentType: kind, documentName: name, fileName: photo.fileName, imageBase64: photo.dataUrl });
      await refresh();
    } catch (err) {
      const message = messageOf(err, 'The photo could not be sent. Check your connection and try again.');
      setErrors((e) => ({ ...e, [kind === 'SELFIE' ? 'face' : kind.startsWith('ID_') ? 'scan' : 'documents']: message }));
    } finally {
      setBusy('');
    }
  };

  const readId = async () => {
    setBusy('read');
    try {
      const result = await api.processKycId();
      setReadMessage(result.validation.qualityMessage);
      await refresh();
    } catch (err) {
      setErrors((e) => ({ ...e, scan: messageOf(err, 'Your ID could not be read.') }));
    } finally {
      setBusy('');
    }
  };

  const compareAgain = async () => {
    setBusy('SELFIE');
    try {
      if (!(await save())) return;
      await api.matchKycFace();
      await refresh();
    } catch (err) {
      setErrors((e) => ({ ...e, face: messageOf(err, 'Your selfie could not be compared.') }));
    } finally {
      setBusy('');
    }
  };

  const fromLibrary = async (kind: string, name: string) => {
    setCamera(null);
    try {
      const photo = await pickImage('library');
      if (photo) await handlePhoto(kind, name, photo);
    } catch (err) {
      setErrors((e) => ({ ...e, [kind === 'SELFIE' ? 'face' : kind.startsWith('ID_') ? 'scan' : 'documents']: messageOf(err, 'The photo could not be opened.') }));
    }
  };

  // ---- navigation, save and submit ----
  const goTo = async (i: number) => {
    if (!kycStepLocked(STEPS[step], requested)) await save();
    setErrors({});
    setNotice('');
    setStep(i);
  };

  const next = async () => {
    const f = formRef.current;
    if (!f || !status) return;
    if (!kycStepLocked(STEPS[step], requested)) {
      const fieldErrors = missing(step, f, status, today);
      const onlyFields = Object.fromEntries(Object.entries(fieldErrors).filter(([k]) => !['scan', 'face', 'documents'].includes(k)));
      if (hasErrors(onlyFields)) {
        setErrors(fieldErrors);
        return;
      }
      setBusy('next');
      const ok = await save();
      const s = ok && ['id', 'selfie', 'more'].includes(STEPS[step].key) ? await refresh() : status;
      setBusy('');
      if (!ok || !s) return;
      const e = missing(step, f, s, today);
      if (hasErrors(e)) {
        setErrors(e);
        return;
      }
    }
    setErrors({});
    setStep((x) => Math.min(STEPS.length - 1, x + 1));
  };

  const submit = async () => {
    const f = formRef.current;
    if (!f) return;
    const consent = kycFormErrors(f, ['CONSENT'], today);
    if (hasErrors(consent)) {
      setErrors(consent);
      return;
    }
    setBusy('submit');
    try {
      const res = await api.submitKyc(payload(f));
      setDone({ referenceNumber: res.referenceNumber, message: res.message });
    } catch (err) {
      const issues = err instanceof ApiError ? kycIssuesFrom(err.details) : [];
      if (issues.length) {
        const target = Math.min(...issues.map(kycStepOfIssue));
        setStep(target);
        setErrors({ submit: issues.filter((i) => kycStepOfIssue(i) === target).map((i) => i.message).join(' ') });
      } else {
        setErrors({ submit: messageOf(err, 'Your application could not be submitted.') });
      }
    } finally {
      setBusy('');
    }
  };

  // ---- render ----
  if (loadError && !status) return <SafeAreaView style={styles.safe}><ScreenHeader title="Verify your identity" /><ErrorView message={loadError} onRetry={load} /></SafeAreaView>;
  if (!status || !form) return <SafeAreaView style={styles.safe}><ScreenHeader title="Verify your identity" /><LoadingView text="Loading your application…" /></SafeAreaView>;

  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={34} color={colors.white} />
          </View>
          <Text style={styles.successTitle}>Submitted for review</Text>
          <Text style={styles.successMsg}>{done.message} A branch officer reviews it, usually within 1–2 working days.</Text>
          <Text style={styles.successRef}>Reference {done.referenceNumber}</Text>
          <AppButton title="View verification status" onPress={() => navigation.navigate('KycStatus')} style={{ marginTop: 20, alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!kycCanEdit(status)) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Verify your identity" />
        <View style={styles.successWrap}>
          <Text style={styles.successTitle}>{status.statusLabel}</Text>
          <Text style={styles.successMsg}>
            {status.kycStatus === 'REJECTED' ? 'Your application was not approved. Please contact your branch for help.' : 'Your application cannot be changed right now.'}
          </Text>
          <AppButton title="View verification status" onPress={() => navigation.navigate('KycStatus')} style={{ marginTop: 20, alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

  const current = STEPS[step];
  const locked = kycStepLocked(current, requested);
  const idType = findIdType(form.idType);
  const front = stored(status, 'ID_FRONT');
  const back = stored(status, 'ID_BACK');
  const backNeeded = Boolean(idType?.hasBackSide);
  const selfie = stored(status, 'SELFIE');
  const scan = status.extractedIdData;
  const face = status.faceMatchResult ? faceResultForMember(status.faceMatchResult) : null;
  const supporting = status.requiredDocuments.filter((d) => !IDENTITY_DOCUMENT_KINDS.includes(d.type));
  const asked = parseSections(requested ?? []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Verify your identity" subtitle={`Step ${step + 1} of ${STEPS.length}`} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <WizardHeader steps={STEPS} current={step} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {asked.length ? (
            <View style={[styles.banner, locked ? styles.bannerMuted : styles.bannerWarn]}>
              <Text style={styles.bannerTitle}>{locked ? 'No changes needed here' : 'Your branch asked you to update this'}</Text>
              <Text style={styles.bannerText}>
                {locked ? `Your branch asked for changes to: ${asked.map((s) => KYC_SECTION_LABELS[s]).join(', ')}.` : status.correctionReason ?? ''}
              </Text>
            </View>
          ) : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {errors.submit ? <Text style={styles.errorBanner}>{errors.submit}</Text> : null}

          {current.key === 'personal' ? (
            <>
              <Part locked={!open('PERSONAL_INFO')}>
                <AppCard style={{ marginBottom: 12 }}>
                  <Text style={styles.cardTitle}>About you</Text>
                  <AppTextInput label="First name" value={form.firstName} onChangeText={(v) => set('firstName', v)} error={errors.firstName} />
                  {!form.hasNoMiddleName ? <AppTextInput label="Middle name" value={form.middleName} onChangeText={(v) => set('middleName', v)} error={errors.middleName} /> : null}
                  <Toggle label="I have no middle name" value={form.hasNoMiddleName} onChange={(v) => set('hasNoMiddleName', v)} />
                  <AppTextInput label="Last name" value={form.lastName} onChangeText={(v) => set('lastName', v)} error={errors.lastName} />
                  <AppTextInput label="Suffix (Jr., III…)" value={form.suffix} onChangeText={(v) => set('suffix', v)} />
                  <AppTextInput label="Date of birth (YYYY-MM-DD)" value={form.dateOfBirth} onChangeText={(v) => set('dateOfBirth', v)} keyboardType="numbers-and-punctuation" error={errors.dateOfBirth} />
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
              </Part>
              <Part locked={!open('ADDRESS')}>
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
              </Part>
            </>
          ) : null}

          {current.key === 'id' ? (
            <Part locked={locked}>
              <AppCard>
                <Label text="Which ID are you using?" />
                <Chips options={ID_TYPES.map((t) => t.label)} selected={idType?.label ?? ''} onSelect={(label) => set('idType', ID_TYPES.find((t) => t.label === label)?.code ?? form.idType)} />
                <Text style={styles.hint}>Use an ID that has not expired. The name must match your application.</Text>
                <PhotoBlock
                  title={backNeeded ? 'Front of the ID' : 'Photo page of the ID'}
                  uri={front?.fileUrl ?? null}
                  received={Boolean(front)}
                  busy={busy === 'ID_FRONT'}
                  onCamera={() => setCamera('ID_FRONT')}
                  onLibrary={() => fromLibrary('ID_FRONT', 'Government ID (front)')}
                />
                {backNeeded ? (
                  <PhotoBlock
                    title="Back of the ID"
                    uri={back?.fileUrl ?? null}
                    received={Boolean(back)}
                    busy={busy === 'ID_BACK'}
                    disabled={!front}
                    onCamera={() => setCamera('ID_BACK')}
                    onLibrary={() => fromLibrary('ID_BACK', 'Government ID (back)')}
                  />
                ) : null}
                {busy === 'read' ? <Text style={styles.hint}>Reading your ID…</Text> : null}
                {scan ? (
                  <View style={[styles.result, scan.status === 'COMPLETED' && scan.isReadable !== false ? styles.resultOk : styles.resultWarn]}>
                    <Text style={styles.resultText}>
                      {readMessage ||
                        (scan.status === 'COMPLETED' && scan.isReadable !== false
                          ? 'Your ID was read. Check every detail on the next step.'
                          : scan.status === 'UNAVAILABLE'
                            ? 'Automatic reading is not available. Type the details exactly as printed on the next step.'
                            : 'Your ID could not be read clearly. Retake the photos, or type the details on the next step.')}
                    </Text>
                    {scan.validationWarnings.map((w) => <Text key={w} style={styles.resultSub}>• {w}</Text>)}
                  </View>
                ) : null}
                {front && (!backNeeded || back) && (!scan || scan.status !== 'COMPLETED' || scan.isReadable === false) ? (
                  <AppButton title={scan ? 'Read my ID again' : 'Read my ID'} variant="outline" loading={busy === 'read'} onPress={readId} style={{ marginTop: 8 }} />
                ) : null}
                {errors.scan ? <Text style={styles.fieldError}>{errors.scan}</Text> : null}
                <Text style={styles.hint}>Reading your ID only fills in its details for you to check. It does not verify the ID: a branch officer reviews it.</Text>
              </AppCard>
            </Part>
          ) : null}

          {current.key === 'idReview' ? (
            <Part locked={locked}>
              <AppCard>
                <Text style={styles.hint}>
                  {scan?.status === 'COMPLETED' ? 'These details were read automatically and may contain mistakes. Compare each one with your card.' : 'Enter the details exactly as printed on your ID.'}
                </Text>
                <AppTextInput label="ID number" value={form.idNumber} onChangeText={(v) => set('idNumber', v)} autoCapitalize="characters" hint={idType ? `e.g. ${idType.example}` : undefined} error={errors.idNumber} />
                <ReadValue read={scan?.idNumber} current={form.idNumber} onUse={(v) => set('idNumber', v)} />
                <AppTextInput label="Name exactly as printed on the ID" value={form.nameOnId} onChangeText={(v) => set('nameOnId', v)} error={errors.nameOnId} />
                <ReadValue read={scan?.fullName} current={form.nameOnId} onUse={(v) => set('nameOnId', v)} />
                <AppTextInput label="Valid until (YYYY-MM-DD, if any)" value={form.idExpiryDate} onChangeText={(v) => set('idExpiryDate', v)} keyboardType="numbers-and-punctuation" error={errors.idExpiryDate} />
                <ReadValue read={scan?.expirationDate} current={form.idExpiryDate} onUse={(v) => set('idExpiryDate', v)} />
                {status.discrepancies.length ? (
                  <View style={[styles.result, styles.resultWarn]}>
                    <Text style={styles.resultText}>Some details look different from your ID. If your entries are correct, you can continue; a branch officer will look at the difference.</Text>
                  </View>
                ) : null}
              </AppCard>
            </Part>
          ) : null}

          {current.key === 'selfie' ? (
            <Part locked={locked}>
              <AppCard>
                <Text style={styles.cardTitle}>How your selfie is used</Text>
                <Text style={styles.hint}>
                  Your selfie is compared with the photo on your ID to check that the ID is yours. It is sensitive personal information under the Data Privacy Act (RA 10173): it is
                  stored securely, seen only by authorised branch staff and the face-check service, and used only to verify your identity.
                </Text>
                <Consent label="I agree to the use of my selfie to check that it matches my ID photo." value={form.biometricConsent} onChange={(v) => set('biometricConsent', v)} error={errors.biometricConsent} />
                {errors.biometricConsent ? <Text style={styles.fieldError}>{errors.biometricConsent}</Text> : null}
                <PhotoBlock
                  title="Your selfie"
                  uri={selfie?.fileUrl ?? null}
                  received={Boolean(selfie && status.faceMatchResult)}
                  busy={busy === 'SELFIE'}
                  disabled={!form.biometricConsent}
                  onCamera={() => setCamera('SELFIE')}
                  onLibrary={() => fromLibrary('SELFIE', 'Selfie')}
                />
                {face ? (
                  <View style={[styles.result, face.tone === 'ok' ? styles.resultOk : face.tone === 'warn' ? styles.resultWarn : styles.resultInfo]}>
                    <Text style={styles.resultTitle}>{face.title}</Text>
                    <Text style={styles.resultText}>{face.body}</Text>
                  </View>
                ) : selfie && form.biometricConsent ? (
                  <AppButton title="Compare my selfie with my ID" variant="outline" loading={busy === 'SELFIE'} onPress={compareAgain} />
                ) : null}
                {errors.face ? <Text style={styles.fieldError}>{errors.face}</Text> : null}
              </AppCard>
            </Part>
          ) : null}

          {current.key === 'more' ? (
            <>
              <Part locked={!open('FINANCIAL')}>
                <AppCard style={{ marginBottom: 12 }}>
                  <Text style={styles.cardTitle}>Work and income</Text>
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
              </Part>
              <Part locked={!open('DOCUMENTS')}>
                <AppCard>
                  <Text style={styles.cardTitle}>Supporting documents</Text>
                  {supporting.length === 0 ? <Text style={styles.hint}>No other documents are required.</Text> : null}
                  {supporting.map((d) => (
                    <View key={d.type} style={styles.docRow}>
                      <Ionicons name={d.submitted ? 'checkmark-circle' : 'document-outline'} size={20} color={d.submitted ? colors.green : colors.textMuted} />
                      <View style={styles.flex1}>
                        <Text style={styles.docName}>{d.name}</Text>
                        <Text style={styles.hint}>{d.submitted ? d.fileName ?? 'Received' : 'Not uploaded yet'}</Text>
                      </View>
                      <AppButton title={d.submitted ? 'Replace' : 'Upload'} size="sm" variant="outline" loading={busy === d.type} onPress={() => fromLibrary(d.type, d.name)} />
                    </View>
                  ))}
                  {errors.documents ? <Text style={styles.fieldError}>{errors.documents}</Text> : null}
                </AppCard>
              </Part>
            </>
          ) : null}

          {current.key === 'review' ? (
            <AppCard>
              <Text style={styles.cardTitle}>Please confirm</Text>
              <Summary label="Name" value={[form.firstName, form.hasNoMiddleName ? '' : form.middleName, form.lastName, form.suffix].filter(Boolean).join(' ')} />
              <Summary label="Born" value={`${form.dateOfBirth} · ${form.placeOfBirth}`} />
              <Summary label="ID" value={`${idType?.label ?? form.idType} · ${form.idNumber ? `••••${form.idNumber.replace(/[\s-]/g, '').slice(-4)}` : '—'}`} />
              <Summary label="Address" value={[form.currentHouseNumber, form.currentStreet, form.currentBarangayName, form.currentCityName, form.currentProvinceName].filter(Boolean).join(', ')} />
              <Summary label="Income" value={`₱${form.monthlyIncome} a month · ${form.sourceOfIncome}`} />
              {STEPS.slice(0, -1).map((st, i) =>
                hasErrors(missing(i, form, status, today)) ? (
                  <TouchableOpacity key={st.key} onPress={() => goTo(i)} accessibilityRole="button">
                    <Text style={styles.fieldError}>Needs attention: {st.title} (tap to open)</Text>
                  </TouchableOpacity>
                ) : null,
              )}
              <View style={{ height: 12 }} />
              <Consent label="The information I gave is true, correct and complete." value={form.truthfulInformation} onChange={(v) => set('truthfulInformation', v)} error={errors.truthfulInformation} />
              <Consent label="The ID and documents I uploaded are mine and genuine." value={form.documentOwnership} onChange={(v) => set('documentOwnership', v)} error={errors.documentOwnership} />
              <Consent label="I allow HOSCOMCO branch staff to review and verify my information and documents." value={form.authorizedReview} onChange={(v) => set('authorizedReview', v)} />
              <Consent label="I have read the Data Privacy Notice and agree to the processing of my personal information under RA 10173." value={form.privacyNotice} onChange={(v) => set('privacyNotice', v)} error={errors.privacyNotice} />
              <Consent label="I understand that false information or documents may lead to rejection and other action under the law." value={form.penaltyAcknowledgment} onChange={(v) => set('penaltyAcknowledgment', v)} />
            </AppCard>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 ? <AppButton title="Back" variant="outline" onPress={() => goTo(step - 1)} style={styles.footerBtn} /> : null}
          <AppButton
            title="Save"
            variant="secondary"
            loading={busy === 'draft'}
            disabled={locked}
            onPress={async () => {
              setBusy('draft');
              if (await save()) setNotice('Your progress is saved. You can finish later.');
              setBusy('');
            }}
            style={styles.footerBtn}
          />
          {step < STEPS.length - 1 ? (
            <AppButton title="Next" onPress={next} loading={busy === 'next'} style={styles.footerBtnWide} disabled={busy !== '' && busy !== 'next'} />
          ) : (
            <AppButton title="Submit" onPress={submit} loading={busy === 'submit'} style={styles.footerBtnWide} disabled={!kycStepsValid(form, ['CONSENT'], today) || busy !== ''} />
          )}
        </View>
      </KeyboardAvoidingView>

      <GuidedCamera
        visible={camera !== null}
        target={camera === 'SELFIE' ? 'FACE' : 'ID'}
        title={camera === 'SELFIE' ? 'Your selfie' : camera === 'ID_BACK' ? 'Back of your ID' : 'Front of your ID'}
        tips={camera === 'SELFIE' ? SELFIE_TIPS : ID_TIPS}
        onClose={() => setCamera(null)}
        onUseLibrary={() => camera && fromLibrary(camera, camera === 'SELFIE' ? 'Selfie' : camera === 'ID_BACK' ? 'Government ID (back)' : 'Government ID (front)')}
        onCapture={(photo) => {
          const kind = camera;
          setCamera(null);
          if (kind) handlePhoto(kind, kind === 'SELFIE' ? 'Selfie' : kind === 'ID_BACK' ? 'Government ID (back)' : 'Government ID (front)', photo);
        }}
      />
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------

/** A part of the application staff did not ask to change: shown, but not editable. */
const Part: React.FC<{ locked: boolean; children: React.ReactNode }> = ({ locked, children }) =>
  locked ? (
    <View pointerEvents="none" style={{ opacity: 0.55 }} accessibilityState={{ disabled: true }}>
      {children}
    </View>
  ) : (
    <>{children}</>
  );

/** One photo: what is on file, and buttons to take it with the guided camera or choose it from the library. */
const PhotoBlock: React.FC<{ title: string; uri: string | null; received: boolean; busy: boolean; disabled?: boolean; onCamera: () => void; onLibrary: () => void }> = ({
  title,
  uri,
  received,
  busy,
  disabled,
  onCamera,
  onLibrary,
}) => (
  <View style={styles.photoBlock}>
    <View style={styles.photoHead}>
      <Text style={styles.docName}>{title}</Text>
      {received ? <Text style={styles.received}>✓ Received</Text> : null}
    </View>
    {uri ? <Image source={{ uri }} style={styles.preview} resizeMode="contain" accessibilityLabel={title} /> : null}
    <View style={styles.photoRow}>
      <AppButton title={uri ? 'Retake' : 'Take photo'} size="sm" loading={busy} disabled={disabled} onPress={onCamera} style={styles.photoBtn} />
      <AppButton title="Choose photo" size="sm" variant="outline" disabled={busy || disabled} onPress={onLibrary} style={styles.photoBtn} />
    </View>
  </View>
);

/** The value read from the ID under a field, with a button to use it. */
const ReadValue: React.FC<{ read: string | null | undefined; current: string; onUse: (v: string) => void }> = ({ read, current, onUse }) =>
  read ? (
    <View style={styles.readRow}>
      <Text style={styles.hint}>
        Read from your ID: <Text style={styles.readValue}>{read}</Text>
      </Text>
      {read.trim().toUpperCase() !== current.trim().toUpperCase() ? (
        <TouchableOpacity onPress={() => onUse(read)} accessibilityRole="button" style={styles.useBtn}>
          <Text style={styles.useText}>Use this</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null;

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
  banner: { borderRadius: radius.md, padding: 12, marginBottom: 12, borderWidth: 1 },
  bannerWarn: { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder },
  bannerMuted: { backgroundColor: colors.borderLight, borderColor: colors.border },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  bannerText: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  resultWarn: { backgroundColor: colors.warningSoft },
  resultInfo: { backgroundColor: colors.infoSoft },
  resultTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 2 },
  photoBlock: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  photoHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  received: { fontSize: 12, fontWeight: '700', color: colors.greenDark },
  readRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -4, marginBottom: 8 },
  readValue: { fontWeight: '800', color: colors.text },
  useBtn: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder, borderWidth: 1, borderRadius: radius.round, paddingHorizontal: 10, paddingVertical: 4 },
  useText: { fontSize: 12, fontWeight: '800', color: colors.primary },
});
