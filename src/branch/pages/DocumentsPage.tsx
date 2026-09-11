import React, { useCallback, useState } from 'react';
import { Download, FileCheck2, FileUp, Search } from 'lucide-react';
import { PageHeader } from '../../portal/components/ui/PageHeader';
import { Button } from '../../portal/components/ui/Button';
import { Card } from '../../portal/components/ui/Card';
import { StatusBadge } from '../../portal/components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../portal/components/ui/States';
import { Modal } from '../../portal/components/ui/Modal';
import { Field, Input, Select, Textarea } from '../../portal/components/ui/Field';
import { useToast } from '../../portal/components/ui/Toast';
import { useBranchData } from '../hooks/useBranchData';
import { useBranchPermission } from '../hooks/useBranchPermission';
import { documentsService } from '../services';

const TYPE_OPTIONS = ['ID Document', 'Proof of Income', 'Collateral Document', 'Borrower Photo', 'Promissory Note', 'Guarantee / Co-maker', 'Other'];

const DocumentsPage: React.FC = () => {
  const toast = useToast();
  const canUpload = useBranchPermission(['manage_documents', 'assist_clients', 'manage_kyc']);
  const fetcher = useCallback(() => documentsService.list(), []);
  const { data, loading, error, reload } = useBranchData(fetcher);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const rows = (data || []).filter((d) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || d.docName.toLowerCase().includes(q) || d.docNumber.toLowerCase().includes(q) || (d.clientName || '').toLowerCase().includes(q);
    const matchesStatus = !status || d.status === status;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        subtitle="Borrower documents and files on record in this branch"
        actions={
          canUpload && (
            <Button variant="brand" onClick={() => setUploadOpen(true)}>
              <FileUp className="h-4 w-4" /> Upload document
            </Button>
          )
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-40">
            <option value="">All statuses</option>
            <option>Active</option>
            <option>Expired</option>
            <option>Void</option>
            <option>Filed</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading documents…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileCheck2 className="h-6 w-6" />} title="No documents" description="Uploaded borrower documents will appear here." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Document', 'Doc no.', 'Client', 'Linked loan', 'Uploaded by', 'Status', 'Date'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                          <FileCheck2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{d.docName}</p>
                          <p className="text-xs text-slate-400">{d.docType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{d.docNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{d.clientName || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{d.loanNumber || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{d.uploadedBy || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{d.createdAt?.slice(0, 10) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <UploadDocumentModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onDone={() => {
          setUploadOpen(false);
          toast.success('Document uploaded');
          reload();
        }}
      />
    </div>
  );
};

const UploadDocumentModal: React.FC<{ open: boolean; onClose: () => void; onDone: () => void }> = ({ open, onClose, onDone }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    docName: '',
    docType: TYPE_OPTIONS[0],
    clientName: '',
    loanNumber: '',
    docNumber: '',
    notes: '',
  });
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(e.target.files?.[0]?.name || '');
  };

  const submit = async () => {
    if (!form.docName.trim() || !form.clientName.trim()) {
      toast.error('Document name and client are required.');
      return;
    }
    setLoading(true);
    try {
      await documentsService.create({ ...form, fileUrl: `mock://${fileName || 'document'}` });
      onDone();
    } catch (err: any) {
      toast.error(err?.message || 'Unable to upload document.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload document"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={submit} loading={loading}>
            <Download className="h-4 w-4" /> Upload
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Document name" required>
          <Input value={form.docName} onChange={set('docName')} placeholder="e.g. Valid ID (UMID)" />
        </Field>
        <Field label="Document type">
          <Select value={form.docType} onChange={set('docType')}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Client name" required>
          <Input value={form.clientName} onChange={set('clientName')} />
        </Field>
        <Field label="Document number">
          <Input value={form.docNumber} onChange={set('docNumber')} placeholder="Optional" />
        </Field>
        <Field label="Linked loan no.">
          <Input value={form.loanNumber} onChange={set('loanNumber')} placeholder="Optional" />
        </Field>
        <Field label="File">
          <Input type="file" onChange={onFile} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Optional" />
          </Field>
        </div>
      </div>
    </Modal>
  );
};

export default DocumentsPage;