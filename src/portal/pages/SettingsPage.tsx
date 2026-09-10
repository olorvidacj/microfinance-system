import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Link2, Lock, MonitorSmartphone, Save, ShieldAlert, Smartphone } from 'lucide-react';
import { settingsService } from '../services/settings';
import { LoginActivityItem, NotificationPreferences, PrivacyPreferences } from '../types';
import { formatDate } from '../../utils/loanMath';
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorState, LoadingState } from '../components/ui';
import { useToast } from '../components/ui/Toast';

const SettingsPage: React.FC = () => {
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyPreferences | null>(null);
  const [sessions, setSessions] = useState<LoginActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [p, pr, s] = await Promise.all([
        settingsService.notificationPreferences(),
        settingsService.privacyPreferences(),
        settingsService.loginActivity(),
      ]);
      setPrefs(p);
      setPrivacy(pr);
      setSessions(s);
    } catch (err: any) {
      setError(err.message || 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const savePrefs = async () => {
    if (!prefs) return;
    setSavingPrefs(true);
    try {
      await settingsService.saveNotificationPreferences(prefs);
      toast.success('Notification preferences saved.');
    } catch (err: any) {
      toast.error(err.message || 'Unable to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const savePrivacy = async () => {
    if (!privacy) return;
    setSavingPrivacy(true);
    try {
      await settingsService.savePrivacyPreferences(privacy);
      toast.success('Privacy preferences saved.');
    } catch (err: any) {
      toast.error(err.message || 'Unable to save preferences.');
    } finally {
      setSavingPrivacy(false);
    }
  };

  if (loading) return <LoadingState label="Loading settings…" />;
  if (error || !prefs || !privacy) return <ErrorState message={error || 'No settings data.'} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage notifications, privacy, and security.</p>
      </div>

      {/* Notification preferences */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <BellRing className="h-4 w-4 text-emerald-600" /> Notification preferences
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            <ToggleRow
              label="Payment reminders"
              desc="Get notified before your installment due dates."
              checked={prefs.paymentReminders}
              onChange={(v) => setPrefs({ ...prefs, paymentReminders: v })}
            />
            <ToggleRow
              label="Loan updates"
              desc="Application status changes, approvals, and disbursements."
              checked={prefs.loanUpdates}
              onChange={(v) => setPrefs({ ...prefs, loanUpdates: v })}
            />
            <ToggleRow
              label="Savings updates"
              desc="Deposits, withdrawals, and interest crediting."
              checked={prefs.savingsUpdates}
              onChange={(v) => setPrefs({ ...prefs, savingsUpdates: v })}
            />
            <ToggleRow
              label="Cooperative announcements"
              desc="General assembly, seminars, and community news."
              checked={prefs.announcements}
              onChange={(v) => setPrefs({ ...prefs, announcements: v })}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={savePrefs} loading={savingPrefs}>
              <Save className="h-4 w-4" /> Save preferences
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-600" /> Privacy
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            <ToggleRow
              label="Share analytics data"
              desc="Help HOSCOMO improve its services with anonymized usage data."
              checked={privacy.shareDataAnalytics}
              onChange={(v) => setPrivacy({ ...privacy, shareDataAnalytics: v })}
            />
            <ToggleRow
              label="SMS marketing messages"
              desc="Receive promos and new-product announcements via SMS."
              checked={privacy.allowSmsMarketing}
              onChange={(v) => setPrivacy({ ...privacy, allowSmsMarketing: v })}
            />
            <ToggleRow
              label="Email alerts"
              desc="Product news and membership updates by email."
              checked={privacy.allowEmailAlerts}
              onChange={(v) => setPrivacy({ ...privacy, allowEmailAlerts: v })}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={savePrivacy} loading={savingPrivacy}>
              <Save className="h-4 w-4" /> Save preferences
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4 text-emerald-600" /> Login security
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-3 text-sm text-slate-500">Recent sign-in sessions on your account.</p>
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{s.device}</p>
                    <p className="text-xs text-slate-400">
                      {s.location} · {formatDate(s.time)}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {s.status === 'ACTIVE' ? 'Active' : s.status.replace(/_/g, ' ')}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> To change your password, sign out and use the{' '}
              <span className="font-medium text-emerald-700">Forgot password</span> option.
            </span>
          </p>
        </CardBody>
      </Card>

      {/* Danger zone */}
      <Card className="border-rose-200">
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2 text-rose-600">
              <ShieldAlert className="h-4 w-4" /> Account
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Need to close your account or update sensitive information?</p>
          <Link to="/portal/support" className="text-sm font-semibold text-rose-600 hover:underline">
            Contact member support
          </Link>
        </CardBody>
      </Card>
    </div>
  );
};

const ToggleRow: React.FC<{ label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label,
  desc,
  checked,
  onChange,
}) => (
  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50">
    <div>
      <p className="text-sm font-medium text-slate-800">{label}</p>
      <p className="text-xs text-slate-500">{desc}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  </label>
);

export default SettingsPage;