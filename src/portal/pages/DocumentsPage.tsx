import React, { useEffect, useState } from 'react';
import { Download, Eye, FileText, Printer } from 'lucide-react';
import { documentService } from '../services/documents';
import { savingsService } from '../services/savings';
import { PortalDocument, SavingsTransaction } from '../types';
import { formatCurrency, formatDate } from '../../utils/loanMath';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
} from '../components/ui';

const DocumentsPage: React.FC = () => {
  const [docs, setDocs] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PortalDocument | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setDocs(await documentService.list());
    } catch (err: any) {
      setError(err.message || 'Unable to load documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const downloadStatement = async () => {
    try {
      const tx = await savingsService.transactions();
      const header = ['Date', 'Type', 'Description', 'Amount', 'Balance', 'Reference'];
      const lines = tx.map((t: SavingsTransaction) =>
        [t.date, t.type, (t.notes || '').replace(/,/g, ' '), t.amount, t.balanceAfter, t.referenceNumber].join(',')
      );
      const csv = [header.join(','), ...lines].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HOSCOMO-savings-statement-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };

  const printDoc = (doc: PortalDocument) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${doc.name}</title></head><body style="font-family:system-ui;padding:40px;color:#0f172a"><h2>HOSCOMO Microfinance Cooperative</h2><h3>${doc.name}</h3><p style="color:#64748b">${doc.type} · ${formatDate(doc.date)}${doc.relatedLoanNumber ? ' · ' + doc.relatedLoanNumber : ''}</p><hr/><p>This is a digitally generated copy for your records. To keep a copy, use the print dialog (Ctrl+P → Save as PDF).</p></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  if (loading) return <LoadingState label="Loading documents…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500">Statements, receipts, and agreements for your records.</p>
        </div>
        <Button variant="outline" onClick={downloadStatement}>
          <Download className="h-4 w-4" /> Download savings statement
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available documents</CardTitle>
        </CardHeader>
        {docs.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="No documents available yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-400">
                    {d.type}
                    {d.relatedLoanNumber ? ` · ${d.relatedLoanNumber}` : ''} · {formatDate(d.date)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPreview(d)}>
                  <Eye className="h-3.5 w-3.5" /> View
                </Button>
                <Button variant="ghost" size="sm" onClick={() => printDoc(d)}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Preview modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name || 'Document'} size="sm">
        {preview && (
          <div>
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{preview.name}</p>
                <p className="text-xs text-slate-400">
                  {preview.type} · {formatDate(preview.date)}
                  {preview.relatedLoanNumber ? ` · ${preview.relatedLoanNumber}` : ''}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              A digitally generated copy is available for printing or saving as a PDF.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => preview && printDoc(preview)}>
                <Printer className="h-4 w-4" /> Print / Save PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DocumentsPage;