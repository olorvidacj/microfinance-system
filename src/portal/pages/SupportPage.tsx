import React, { useEffect, useState } from 'react';
import { ChevronDown, Clock, LifeBuoy, MessageCircleQuestion, Plus, Send } from 'lucide-react';
import { supportService } from '../services/support';
import { ApiError } from '../services/clientApi';
import { SUPPORT_CATEGORIES, validateSupportRequest, type FaqView, type SupportCategory, type SupportContactView, type SupportRequestView } from '../../../shared/client';
import { formatDate } from '../../utils/loanMath';
import { Button, Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorState, Field, Input, LoadingState, Modal, Select, StatusBadge, Textarea } from '../components/ui';
import { useToast } from '../components/ui/Toast';

const SupportPage: React.FC = () => {
  const toast = useToast();
  const [categories, setCategories] = useState<string[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, FaqView[]>>({});
  const [tickets, setTickets] = useState<SupportRequestView[]>([]);
  const [contact, setContact] = useState<SupportContactView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const [ticketOpen, setTicketOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportCategory>('Loans');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [faqs, list, branch] = await Promise.all([supportService.faqs(), supportService.tickets(), supportService.contact()]);
      setCategories(faqs.categories);
      setByCategory(faqs.byCategory);
      setTickets(list);
      setContact(branch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load support content.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    // Same checks as the server (shared/client/support.ts).
    const v = validateSupportRequest({ subject, category, message });
    setErrors(v.errors);
    if (!v.ok) return;
    setSubmitting(true);
    try {
      const ticket = await supportService.submit(v.value);
      setTickets((prev) => [ticket, ...prev]);
      setTicketOpen(false);
      setSubject('');
      setMessage('');
      toast.success('Your message was sent to your branch.');
    } catch (err) {
      const fields = err instanceof ApiError && err.details && typeof err.details.fields === 'object' ? (err.details.fields as Record<string, string>) : {};
      setErrors(fields);
      toast.error(err instanceof Error ? err.message : 'Your message could not be sent.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading help center…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Help & Support</h1>
          <p className="text-sm text-slate-500">Answers to common questions and ways to reach your branch.</p>
        </div>
        <Button onClick={() => setTicketOpen(true)}>
          <Plus className="h-4 w-4" /> Message your branch
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <MessageCircleQuestion className="h-4 w-4 text-emerald-600" /> Frequently asked questions
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-6">
              {categories.map((cat) => (
                <div key={cat}>
                  <h4 className="mb-2 text-sm font-semibold text-slate-700">{cat}</h4>
                  <div className="space-y-2">
                    {(byCategory[cat] || []).map((f) => {
                      const open = openFaq === f.id;
                      return (
                        <div key={f.id} className="overflow-hidden rounded-xl border border-slate-200">
                          <button
                            onClick={() => setOpenFaq(open ? null : f.id)}
                            className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {f.question}
                            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                          </button>
                          {open && <p className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">{f.answer}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My messages</CardTitle>
              <span className="text-xs text-slate-400">{tickets.length} sent</span>
            </CardHeader>
            {tickets.length === 0 ? (
              <EmptyState icon={<LifeBuoy className="h-6 w-6" />} title="No messages yet" description="Messages you send to your branch are listed here, with whether the branch has seen them." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <li key={t.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <StatusBadge status={t.read ? 'Seen by branch' : 'Sent'} tone={t.read ? 'green' : 'amber'} />
                        <p className="mt-1 break-words text-sm font-semibold text-slate-800">{t.subject}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Sent {formatDate(t.sentAt)} · your branch will contact you
                          </span>
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{t.category}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {contact && (
            <Card className="bg-gradient-to-br from-emerald-700 to-teal-800 text-white">
              <CardBody>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <LifeBuoy className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold">Your branch</h3>
                <div className="mt-3 space-y-2 text-sm text-emerald-50">
                  <p className="font-semibold">{contact.branchName}</p>
                  <p>{contact.address}{contact.city ? `, ${contact.city}` : ''}</p>
                  {contact.phone && (
                    <p>
                      <span className="font-semibold">Phone:</span>{' '}
                      <a className="underline" href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a>
                    </p>
                  )}
                </div>
                <Button className="mt-5 w-full bg-white/15 text-white hover:bg-white/25" onClick={() => setTicketOpen(true)}>
                  <Send className="h-4 w-4" /> Message your branch
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Modal open={ticketOpen} onClose={() => setTicketOpen(false)} title="Message your branch" size="md">
        <form onSubmit={submitTicket} className="space-y-4">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)} aria-label="Category">
              {SUPPORT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" required error={errors.subject}>
            <Input placeholder="Brief summary of your concern" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
          </Field>
          <Field label="Message" required error={errors.message}>
            <Textarea rows={4} placeholder="Describe the issue in detail…" value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Message" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setTicketOpen(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>
              <Send className="h-4 w-4" /> Send
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SupportPage;
