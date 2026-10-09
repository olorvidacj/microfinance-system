import React from 'react';
import { Check, X } from 'lucide-react';
import { evaluatePassword, PasswordStrengthResult } from '../../utils/passwordValidator';

interface PasswordStrengthIndicatorProps {
  password: string;
  confirmPassword?: string;
  showChecklist?: boolean;
  showConfirmMatch?: boolean;
  className?: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  confirmPassword,
  showChecklist = true,
  showConfirmMatch = true,
  className = '',
}) => {
  const result: PasswordStrengthResult = evaluatePassword(password);
  const { criteria, score, percentage, level, label } = result;

  const hasPassword = password.length > 0;
  const hasConfirm = confirmPassword !== undefined && confirmPassword.length > 0;
  const isMatch = hasPassword && hasConfirm && password === confirmPassword;
  const isMismatch = hasConfirm && password !== confirmPassword;

  const getBarColorClass = () => {
    switch (level) {
      case 'weak':
        return 'bg-rose-500';
      case 'medium':
        return 'bg-amber-500';
      case 'strong':
        return 'bg-emerald-500';
      default:
        return 'bg-slate-200';
    }
  };

  const getTextColorClass = () => {
    switch (level) {
      case 'weak':
        return 'text-rose-600 font-semibold';
      case 'medium':
        return 'text-amber-600 font-semibold';
      case 'strong':
        return 'text-emerald-600 font-bold';
      default:
        return 'text-slate-400';
    }
  };

  const checklistItems = [
    { label: 'At least 8 characters', met: criteria.minLength },
    { label: 'Uppercase letter (A–Z)', met: criteria.hasUpper },
    { label: 'Lowercase letter (a–z)', met: criteria.hasLower },
    { label: 'Number (0–9)', met: criteria.hasNumber },
    { label: 'Special character (!@#$%^&*)', met: criteria.hasSpecial },
  ];

  return (
    <div className={`space-y-2 mt-2 ${className}`}>
      {/* Strength Bar & Text (shown when user starts typing) */}
      {hasPassword && (
        <div className="space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Password strength:</span>
            <span className={`text-xs ${getTextColorClass()}`}>{label}</span>
          </div>

          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
            <div
              className={`h-full transition-all duration-300 rounded-full ${getBarColorClass()}`}
              style={{ width: `${Math.max(percentage, 5)}%` }}
            />
          </div>
        </div>
      )}

      {/* Checklist */}
      {showChecklist && (
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs space-y-1.5 mt-2">
          <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider mb-1">
            Password Requirements:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {checklistItems.map((item, index) => (
              <div
                key={index}
                className={`flex items-center gap-1.5 transition-colors duration-150 ${
                  item.met
                    ? 'text-emerald-700 font-medium'
                    : hasPassword
                    ? 'text-slate-500'
                    : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 text-[10px] transition-all duration-200 ${
                    item.met
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'border border-slate-300 bg-white text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span className="text-[11px]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Password matching status banner */}
      {showConfirmMatch && hasConfirm && (
        <div
          className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl transition-all duration-200 ${
            isMatch
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {isMatch ? (
            <>
              <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </div>
              <span className="font-semibold">Passwords match</span>
            </>
          ) : (
            <>
              <div className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                <X className="w-2.5 h-2.5 stroke-[3]" />
              </div>
              <span>Passwords do not match</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
