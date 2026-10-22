import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, Send } from 'lucide-react';
import { KYC_SECTION_LABELS, parseSections } from '../../../shared/kyc-core';
import { EMPTY_KYC_FORM, kycCanEdit, kycFormErrors, kycFormFrom, kycIssuesFrom, manilaToday, type KycFormState } from '../../../shared/client';
import { ErrorState, LoadingState } from '../components/ui';
import { ApiError } from '../services/clientApi';
import { profileService } from '../services/profile';
import type { KycStatusData } from '../types';
import { Notice } from './controls';
import { KycStatusPanel } from './KycStatusPanel';
import { KycWelcome } from './KycWelcome';
import { IdReviewStep } from './steps/IdReviewStep';
import { IdStep } from './steps/IdStep';
import { MoreStep } from './steps/MoreStep';
import { PersonalStep } from './steps/PersonalStep';
import { ReviewStep } from './steps/ReviewStep';
import { SelfieStep } from './steps/SelfieStep';
import type { StepProps } from './steps/types';
import { WIZARD_STEPS, applicationToSend, requestedSections, resumeStep, stepComplete, stepIndex, stepLocked, stepOfIssue, type WizardStepKey } from './wizard';

/**
 * /portal/kyc: the member's guided identity verification. A welcome screen,
 * six steps with progress saved as they go, and the status once submitted.
 * Every rule that matters is the server's: this page shows them early and
 * explains them, but the server decides what is accepted.
 */

const STEP_VIEWS: Readonly<Record<WizardStepKey, React.FC<StepProps>>> = {
  personal: PersonalStep,
  id: IdStep,
  idReview: IdReviewStep,
  selfie: SelfieStep,
  more: MoreStep,
  review: ReviewStep,
};

type View = 'welcome' | 'wizard' | 'status';
type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

const AUTOSAVE_MS = 4000;

/** What is still missing in a step that the form checks cannot see (photos, checks, documents). */
function missingInStep(key: WizardStepKey, status: KycStatusData, form: KycFormState): string | null {
  const has = (kind: string) => status.requiredDocuments.some((d) => d.type === kind && d.submitted);
  switch (key) {
    case 'id':
      if (!has('ID_FRONT')) return 'Add a photo of your ID.';
      if (status.requiredDocuments.some((d) => d.type === 'ID_BACK') && !has('ID_BACK')) return 'Add a photo of the back of your ID.';
      if (!status.extractedIdData) return 'Read your ID before you continue.';
      return null;
    case 'selfie':
      if (!form.biometricConsent) return 'Agree to the use of your selfie to continue.';
      if (!has('SELFIE')) return 'Take your selfie to continue.';
      if (!status.faceMatchResult) return 'Compare your selfie with your ID to continue.';
      return null;
    case 'more': {
      const missing = status.requiredDocuments.filter((d) => !['ID_FRONT', 'ID_BACK', 'SELFIE'].includes(d.type) && !d.submitted);
      return missing.length ? `Upload: ${missing.map((d) => d.name).join(', ')}.` : null;
    }
    default:
      return null;
  }
}

export default function KycWizardPage() {
  const navigate = useNavigate();
  const today = manilaToday();
  const [status, setStatus] = useState<KycStatusData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<KycFormState>(EMPTY_KYC_FORM);
  const [view, setView] = useState<View>('welcome');
  const [index, setIndex] = useState(0);
  const [attempted, setAttempted] = useState<ReadonlySet<WizardStepKey>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [banner, setBanner] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const formRef = useRef(form);
  const statusRef = useRef(status);
  const indexRef = useRef(index);
  const versionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const chainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  statusRef.current = status;
  indexRef.current = index;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const s = await profileService.kycStatus();
      const f = kycFormFrom(s);
      setStatus(s);
      setForm(f);
      formRef.current = f;
      versionRef.current = 0;
      savedVersionRef.current = 0;
      if (!kycCanEdit(s) || s.kycStatus === 'CORRECTION_REQUIRED' || s.kycStatus === 'REJECTED') setView('status');
      else if (s.kycStatus === 'IN_PROGRESS') {
        setIndex(resumeStep(f, s, manilaToday()));
        setView('wizard');
      } else setView('welcome');
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Your verification could not be loaded.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async (): Promise<KycStatusData | null> => {
    try {
      const s = await profileService.kycStatus();
      setStatus(s);
      return s;
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'Your latest status could not be loaded. Check your connection.');
      return null;
    }
  }, []);

  const update = useCallback((patch: Partial<KycFormState>) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      formRef.current = next;
      return next;
    });
    versionRef.current += 1;
    // A message about the last attempt no longer applies once the member changes something.
    setBanner(null);
  }, []);

  /** Saves what may be changed now; calls run one after another so an older save never lands last. */
  const save = useCallback((): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const st = statusRef.current;
      if (!st) return false;
      const version = versionRef.current;
      setSaveState({ kind: 'saving' });
      try {
        await profileService.saveDraft({ ...applicationToSend(formRef.current, st), currentStep: indexRef.current + 1 });
        savedVersionRef.current = Math.max(savedVersionRef.current, version);
        setSaveState({ kind: 'saved' });
        return true;
      } catch (err) {
        setSaveState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Your progress could not be saved. Check your connection.' });
        return false;
      }
    };
    const next = chainRef.current.then(run, run);
    chainRef.current = next;
    return next;
  }, []);

  const dirty = () => versionRef.current > savedVersionRef.current;
  const step = WIZARD_STEPS[index];
  const requested = requestedSections(status);
  const locked = stepLocked(step, requested);

  // Autosave a moment after the member stops typing, and when the tab is hidden or closed.
  useEffect(() => {
    if (view !== 'wizard' || locked || !dirty()) return;
    const t = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [form, view, locked, save]);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && dirty() && void save();
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!dirty()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [save]);

  const goTo = useCallback(
    async (target: number) => {
      if (dirty() && !stepLocked(WIZARD_STEPS[indexRef.current], requestedSections(statusRef.current))) await save();
      setBanner(null);
      setIndex(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      requestAnimationFrame(() => headingRef.current?.focus());
    },
    [save],
  );

  const submit = async () => {
    const st = statusRef.current;
    if (!st) return;
    try {
      const result = await profileService.submitKyc(applicationToSend(formRef.current, st));
      savedVersionRef.current = versionRef.current;
      await refresh();
      setSubmitted(result.referenceNumber ?? '');
      setView('status');
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INCOMPLETE') {
        const issues = kycIssuesFrom(err.details);
        setAttempted(new Set(WIZARD_STEPS.map((s) => s.key)));
        const target = issues.length ? Math.min(...issues.map(stepOfIssue)) : index;
        await goTo(target);
        setBanner(issues.filter((i) => stepOfIssue(i) === target).map((i) => i.message).join(' ') || err.message);
      } else if (err instanceof ApiError && err.code === 'DUPLICATE') {
        await goTo(stepIndex('idReview'));
        setBanner(err.message);
      } else {
        setBanner(err instanceof ApiError ? err.message : 'Your application could not be submitted. Check your connection and try again.');
      }
    }
  };

  const next = async () => {
    const st = statusRef.current;
    if (!st || advancing) return;
    setBanner(null);
    setAdvancing(true);
    try {
      if (!locked) {
        const errs = kycFormErrors(formRef.current, step.checks, today);
        if (Object.keys(errs).length > 0) {
          setAttempted((a) => new Set(a).add(step.key));
          setBanner('Please check the highlighted fields.');
          requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
          return;
        }
        if (!(await save())) return;
        // What is required can change with what was just saved (the back of the ID depends on its type).
        const fresh = step.key === 'id' || step.key === 'selfie' || step.key === 'more' ? await refresh() : st;
        if (!fresh) return;
        const missing = missingInStep(step.key, fresh, formRef.current);
        if (missing) {
          setBanner(missing);
          return;
        }
      }
      if (step.key === 'review') await submit();
      else await goTo(index + 1);
    } finally {
      setAdvancing(false);
    }
  };

  if (loadError) return <ErrorState title="Verification could not be loaded" message={loadError} onRetry={load} />;
  if (!status) return <LoadingState label="Loading your verification…" />;

  if (view === 'welcome') {
    return (
      <div className="px-1 py-4 sm:py-8">
        <KycWelcome
          resuming={status.kycStatus === 'IN_PROGRESS'}
          onStart={() => {
            setIndex(resumeStep(form, status, today));
            setView('wizard');
          }}
        />
      </div>
    );
  }

  if (view === 'status') {
    const canEdit = kycCanEdit(status);
    return (
      <div className="space-y-4 px-1 py-4 sm:py-8">
        {submitted !== null && (
          <div className="mx-auto max-w-xl">
            <Notice tone="ok" title="Your application was submitted" role="status">
              <p>
                {submitted ? (
                  <>
                    Your reference number is <span className="font-mono font-semibold">{submitted}</span>.{' '}
                  </>
                ) : null}
                A branch officer will review it, usually within 1–2 working days. We will notify you of the result.
              </p>
            </Notice>
          </div>
        )}
        <KycStatusPanel
          status={status}
          variant="page"
          onAction={
            canEdit
              ? () => {
                  setIndex(resumeStep(form, status, today));
                  setView('wizard');
                }
              : undefined
          }
        />
        <div className="mx-auto max-w-xl text-center">
          <button type="button" onClick={() => navigate('/portal')} className="text-sm font-semibold text-navy-900 underline">
            Back to my dashboard
          </button>
        </div>
      </div>
    );
  }

  const StepView = STEP_VIEWS[step.key];
  const shownErrors = attempted.has(step.key) && !locked ? kycFormErrors(form, step.checks, today) : {};
  const sections = parseSections(requested ?? []);
  const isLast = step.key === 'review';

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <div className="flex items-center justify-between gap-2 py-3">
        <button type="button" onClick={() => (index === 0 ? setView('welcome') : goTo(index - 1))} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>
        <span aria-live="polite" className="text-xs text-slate-500">
          {saveState.kind === 'saving' ? 'Saving…' : saveState.kind === 'saved' ? 'Progress saved' : saveState.kind === 'error' ? 'Not saved' : ''}
        </span>
        <button
          type="button"
          onClick={async () => {
            if (!locked && !(await save())) return;
            navigate('/portal');
          }}
          className="rounded-lg px-2 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-100"
        >
          Save and finish later
        </button>
      </div>

      <nav aria-label="Verification steps" className="mb-5">
        <p className="text-sm font-semibold text-gold-700">
          Step {index + 1} of {WIZARD_STEPS.length}
        </p>
        <ol className="mt-2 grid grid-cols-6 gap-1.5">
          {WIZARD_STEPS.map((s, i) => {
            const done = stepComplete(s, form, status, today);
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={i === index ? 'step' : undefined}
                  aria-label={`${s.title}${done ? ', complete' : ''}`}
                  className={`block h-2 w-full rounded-full ${i === index ? 'bg-navy-950' : done ? 'bg-gold-400' : 'bg-slate-200'}`}
                />
              </li>
            );
          })}
        </ol>
        <h1 ref={headingRef} tabIndex={-1} className="mt-4 text-2xl font-bold text-navy-950 focus:outline-none">
          {step.title}
        </h1>
        <p className="text-base text-slate-600">{step.subtitle}</p>
      </nav>

      <div className="space-y-4">
        {sections.length > 0 && (
          <Notice tone={locked ? 'locked' : 'warn'} title={locked ? 'No changes needed here' : 'Your branch asked you to update this'}>
            {locked ? <p>Your branch asked for changes to: {sections.map((s) => KYC_SECTION_LABELS[s]).join(', ')}. This part is shown for reference.</p> : status.correctionReason && <p>“{status.correctionReason}”</p>}
          </Notice>
        )}
        {saveState.kind === 'error' && (
          <Notice tone="error" role="alert" title="Your progress was not saved">
            <p>{saveState.message}</p>
          </Notice>
        )}

        <StepView
          form={form}
          update={update}
          errors={shownErrors}
          status={status}
          requested={requested}
          locked={locked}
          today={today}
          save={save}
          refresh={refresh}
          goTo={(key) => goTo(stepIndex(key))}
        />

        {banner && (
          <Notice tone="error" role="alert">
            <p>{banner}</p>
          </Notice>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
        {locked && (
          <span className="inline-flex items-center gap-1 text-sm text-slate-500">
            <Lock className="h-4 w-4" aria-hidden="true" /> Shown for reference
          </span>
        )}
        <button
          type="button"
          onClick={next}
          disabled={advancing}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-400 px-6 py-4 text-lg font-bold text-navy-950 hover:bg-gold-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-300 disabled:opacity-60 sm:ml-auto sm:w-auto"
        >
          {advancing ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : isLast ? <Send className="h-5 w-5" aria-hidden="true" /> : locked ? <Check className="h-5 w-5" aria-hidden="true" /> : null}
          {isLast ? 'Submit for review' : 'Continue'}
          {!isLast && !advancing && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
