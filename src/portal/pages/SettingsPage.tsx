import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Lock, UserRound } from 'lucide-react';
import { settingsService, type SignIn } from '../services/settings';
import { Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorState, LoadingState } from '../components/ui';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { formatDisplayDateTime } from '../../../shared/client/format';


/** Account security: change password and recent sign-ins. */
const SettingsPage: React.FC = () => {
  const [sessions, setSessions] = useState<SignIn[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setSessions(null);
    try {
      setSessions(await settingsService.signIns());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your sign-ins.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Your password and recent sign-ins.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Change password</CardTitle>
          </CardHeader>
          <CardBody>
            <ChangePasswordForm />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Recent sign-ins</CardTitle>
            </CardHeader>
            <CardBody>
              {error ? (
                <ErrorState message={error} onRetry={load} />
              ) : sessions === null ? (
                <LoadingState label="Loading…" />
              ) : sessions.length === 0 ? (
                <EmptyState icon={<History className="h-6 w-6" />} title="No sign-ins recorded yet" />
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {sessions.map((s) => (
                    <li key={s.id} className="py-2 text-slate-700">{formatDisplayDateTime(s.time)}</li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-400">If you see a sign-in you don't recognise, change your password and tell your branch.</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3 text-sm">
              <UserRound className="h-5 w-5 text-emerald-600" />
              <span className="flex-1 text-slate-600">Contact details and address are on your profile.</span>
              <Link to="/portal/profile" className="font-medium text-emerald-700 hover:underline">Open profile</Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
