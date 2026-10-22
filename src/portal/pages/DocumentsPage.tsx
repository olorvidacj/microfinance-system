import React, { useEffect, useState } from 'react';
import { Download, Eye, FileText } from 'lucide-react';
import { documentService } from '../services/documents';
import { savingsService } from '../services/savings';
import { PortalDocument } from '../types';
import { downloadStatement as saveStatementCsv } from '../../components/savings/SavingsStatement';
import { useToast } from '../components/ui/Toast';
import { formatCurrency, formatDate } from '../../utils/loanMath';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/ui';

const DocumentsPage: React.FC = () => {
  const toast = useToast();
  const [docs, setDocs] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  // One CSV per savings account, built from the server statement (running balances included).
  const downloadStatement = async () => {
    try {
      const accounts = await savingsService.accounts();
      if (!accounts.length) {
        toast.info('You have no savings account yet.');
        return;
      }
      for (const a of accounts) saveStatementCsv(await savingsService.statement(a.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The statement could not be downloaded.');
    }
  };

  const openDoc = async (doc: PortalDocument) => {
    try {
      const url = await documentService.fileUrl(doc.id);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The document could not be opened.');
    }
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
                {d.hasFile ? (
                  <Button variant="outline" size="sm" onClick={() => openDoc(d)}>
                    <Eye className="h-3.5 w-3.5" /> Open
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400">No file stored</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

    </div>
  );
};

export default DocumentsPage;