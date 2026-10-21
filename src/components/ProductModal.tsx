import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import {
  FREQUENCY_LABELS,
  INTEREST_METHOD_LABELS,
  LENDING_TYPE_LABELS,
  REPAYMENT_FREQUENCIES,
  INTEREST_METHODS,
  LENDING_TYPES,
  blankProductDto,
  quoteProduct,
  validateProduct,
  type ProductDto,
  type ProductErrors,
} from '../../shared/lending';
import { Modal } from '../portal/components/ui/Modal';
import { Button } from '../portal/components/ui/Button';
import { Field, Input, Select, Textarea } from '../portal/components/ui/Field';
import { LoanQuoteView, manilaToday } from './lending';

interface ProductModalProps {
  open: boolean;
  /** The product to edit, or null to create one. */
  product: ProductDto | null;
  onClose: () => void;
  /** Saves the product; rejects with an error carrying `fieldErrors` when the server refuses fields. */
  onSave: (dto: ProductDto) => Promise<void>;
}

export const ProductModal: React.FC<ProductModalProps> = ({ open, product, onClose, onSave }) => {
  const [form, setForm] = useState<ProductDto>(blankProductDto());
  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<ProductErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(product ? { ...product, fees: product.fees.map((f) => ({ ...f })) } : blankProductDto());
    setTouched(false);
    setServerErrors({});
    setSaveError('');
  }, [open, product]);

  const validation = useMemo(() => validateProduct(form), [form]);
  const errors: ProductErrors = touched ? { ...validation.errors, ...serverErrors } : serverErrors;

  // A sample schedule at the minimum amount and term, so the terms can be checked before saving.
  const sample = useMemo(() => {
    if (!validation.ok || !validation.value) return null;
    try {
      return quoteProduct({ id: 'preview', ...validation.value }, validation.value.minAmount, validation.value.minTermMonths, manilaToday());
    } catch {
      return null;
    }
  }, [validation]);

  const set = <K extends keyof ProductDto>(key: K, value: ProductDto[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setFee = (i: number, patch: Partial<ProductDto['fees'][number]>) =>
    setForm((f) => ({ ...f, fees: f.fees.map((fee, j) => (j === i ? { ...fee, ...patch } : fee)) }));

  const save = async () => {
    setTouched(true);
    setSaveError('');
    if (!validation.ok) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      const fieldErrors = (err as { fieldErrors?: ProductErrors }).fieldErrors ?? {};
      setServerErrors(fieldErrors);
      setSaveError(err instanceof Error ? err.message : 'The product could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? `Edit ${product.name}` : 'New loan product'}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="brand" onClick={save} loading={saving}>
            <Save className="h-4 w-4" /> {product ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {saveError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{saveError}</div>}
        {product && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Changes apply to new applications only. Loans already filed keep the terms they were filed with.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Product name" required error={errors.name}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Micro-enterprise loan" />
          </Field>
          <Field label="Product code" required error={errors.code} hint="Capital letters, digits and dashes">
            <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="ML-MICRO" className="font-mono" />
          </Field>
          <Field label="Category" required error={errors.category}>
            <Input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Livelihood" />
          </Field>
          <Field label="Status" error={errors.status}>
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">Active (open for applications)</option>
              <option value="INACTIVE">Inactive (no new applications)</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" error={errors.description}>
              <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Interest method" required error={errors.interestMethod}>
            <Select value={form.interestMethod} onChange={(e) => set('interestMethod', e.target.value)}>
              {INTEREST_METHODS.map((m) => (
                <option key={m} value={m}>
                  {INTEREST_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Annual interest rate (%)" required error={errors.annualRate}>
            <Input inputMode="decimal" value={form.annualRate} onChange={(e) => set('annualRate', e.target.value)} placeholder="18" />
          </Field>
          <Field label="Repayment frequency" required error={errors.frequency}>
            <Select value={form.frequency} onChange={(e) => set('frequency', e.target.value)}>
              {REPAYMENT_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Minimum amount (₱)" required error={errors.minAmount}>
            <Input inputMode="decimal" value={form.minAmount} onChange={(e) => set('minAmount', e.target.value)} />
          </Field>
          <Field label="Maximum amount (₱)" required error={errors.maxAmount}>
            <Input inputMode="decimal" value={form.maxAmount} onChange={(e) => set('maxAmount', e.target.value)} />
          </Field>
          <Field label="Lending type" required error={errors.lendingType}>
            <Select value={form.lendingType} onChange={(e) => set('lendingType', e.target.value)}>
              {LENDING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LENDING_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Minimum term (months)" required error={errors.minTermMonths}>
            <Input inputMode="numeric" value={String(form.minTermMonths)} onChange={(e) => set('minTermMonths', e.target.value)} />
          </Field>
          <Field label="Maximum term (months)" required error={errors.maxTermMonths}>
            <Input inputMode="numeric" value={String(form.maxTermMonths)} onChange={(e) => set('maxTermMonths', e.target.value)} />
          </Field>
          <Field label="Late penalty (% a month)" required error={errors.penaltyRate}>
            <Input inputMode="decimal" value={form.penaltyRate} onChange={(e) => set('penaltyRate', e.target.value)} placeholder="3" />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Fees deducted at release</h4>
            <Button size="sm" variant="outline" onClick={() => set('fees', [...form.fees, { code: '', label: '', kind: 'PERCENT', value: '' }])}>
              <Plus className="h-3.5 w-3.5" /> Add fee
            </Button>
          </div>
          {form.fees.length === 0 && <p className="text-xs text-slate-400">No fees.</p>}
          {form.fees.map((fee, i) => (
            <div key={i} className="space-y-1">
              <div className="grid grid-cols-12 gap-2">
                <Input className="col-span-3 font-mono" placeholder="PROCESSING" value={fee.code} onChange={(e) => setFee(i, { code: e.target.value.toUpperCase() })} aria-label="Fee code" />
                <Input className="col-span-4" placeholder="Processing fee" value={fee.label} onChange={(e) => setFee(i, { label: e.target.value })} aria-label="Fee label" />
                <Select className="col-span-2" value={fee.kind} onChange={(e) => setFee(i, { kind: e.target.value })} aria-label="Fee type">
                  <option value="PERCENT">% of loan</option>
                  <option value="FIXED">₱ fixed</option>
                </Select>
                <Input className="col-span-2" inputMode="decimal" placeholder={fee.kind === 'PERCENT' ? '2' : '150.00'} value={fee.value} onChange={(e) => setFee(i, { value: e.target.value })} aria-label="Fee amount" />
                <button type="button" className="col-span-1 flex items-center justify-center text-slate-400 hover:text-rose-600" onClick={() => set('fees', form.fees.filter((_, j) => j !== i))} aria-label="Remove fee">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {errors[`fees.${i}`] && <p className="text-xs text-rose-600">{errors[`fees.${i}`]}</p>}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.requiresCollateral} onChange={(e) => set('requiresCollateral', e.target.checked)} /> Requires collateral
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.requiresGuarantor} onChange={(e) => set('requiresGuarantor', e.target.checked)} /> Requires a guarantor
          </label>
        </div>

        {sample && (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Sample: minimum amount over the minimum term</p>
            <LoanQuoteView quote={sample} />
          </div>
        )}
      </div>
    </Modal>
  );
};
