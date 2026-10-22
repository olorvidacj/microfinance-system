import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { profileService } from '../services/profile';
import { ApiError } from '../services/clientApi';
import { Button, Field, PasswordInput } from './ui';
import { useToast } from './ui/Toast';
import { PasswordStrengthIndicator } from '../../components/common/PasswordStrengthIndicator';
import { STRONG_PASSWORD_ERROR_MESSAGE, isPasswordStrong } from '../../../shared/auth/password';

/** Change password: the current one is required; the new one must pass the shared strength rules. */
export const ChangePasswordForm: React.FC = () => {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!current) local.currentPassword = 'Enter your current password.';
    if (!isPasswordStrong(next)) local.newPassword = STRONG_PASSWORD_ERROR_MESSAGE;
    else if (next === current) local.newPassword = 'Choose a password different from your current one.';
    if (next !== confirm) local.confirmPassword = 'The passwords do not match.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      await profileService.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Your password has been changed.');
    } catch (err) {
      const fields = err instanceof ApiError && err.details && typeof err.details.fields === 'object' ? (err.details.fields as Record<string, string>) : {};
      setErrors(fields);
      toast.error(err instanceof Error ? err.message : 'Your password could not be changed.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <Field label="Current password" required error={errors.currentPassword}>
        <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" aria-label="Current password" />
      </Field>
      <Field label="New password" required error={errors.newPassword}>
        <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" aria-label="New password" />
      </Field>
      <Field label="Confirm new password" required error={errors.confirmPassword}>
        <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-label="Confirm new password" />
      </Field>
      <PasswordStrengthIndicator password={next} confirmPassword={confirm} />
      <Button type="submit" loading={saving}>
        <KeyRound className="h-4 w-4" /> Change password
      </Button>
    </form>
  );
};

