import React, { useEffect, useState } from 'react';
import { ChevronDown, Clock, LifeBuoy, MessageCircleQuestion, Plus, Send } from 'lucide-react';
import { supportService } from '../services/support';
import { FaqItem, SupportTicket } from '../types';
import { formatDate } from '../../utils/loanMath';
import { Button, Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorState, Field, Input, LoadingState, Modal, Select, StatusBadge, Textarea } from '../components/ui';
import { useToast } from '../components/ui/Toast';

const SupportPage: React.FC = () => {
  const toast = useToast();
  const [categories, setCategories] = useState<string[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, FaqItem[]>>({});
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const [ticketOpen, setTicketOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Loans');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [faqs, tickets] = await Promise.all([supportService.faqs(), supportService.tickets()]);
      setCategories(faqs.categories);
      setByCategory(faqs.byCategory);
      setTickets(tickets);
    } catch (err: any) {
      setError(err.message || 'Unable to load support content.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in subject and message.');
      return;
    }
    setSubmitting(true);
    try {
      const ticket = await supportService.submit({ subject: subject.trim(), category, message: message.trim() });
      setTickets((prev) => [ticket, ...prev]);
      setTicketOpen(false);
      setSubject('');
      setMessage('');
      toast.success('Your ticket has been submitted. We will respond shortly.');
    } catch (err: any) {
      toast.error(err.message || 'Unable to submit ticket.');
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
          <p className="text-sm text-slate-500">Answers to common questions and ways to reach us.</p>
        </div>
        <Button onClick={() => setTicketOpen(true)}>
          <Plus className="h-4 w-4" /> Submit a ticket
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* FAQ */}
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

          {/* My tickets */}
          <Card>
            <CardHeader>
              <CardTitle>My support tickets</CardTitle>
              <span className="text-xs text-slate-400">{tickets.length} ticket(s)</span>
            </CardHeader>
            {tickets.length === 0 ? (
              <EmptyState
                icon={<LifeBuoy className="h-6 w-6" />}
                title="No tickets filed"
                description="When you submit a support ticket, you can track its status here."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <li key={t.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-400">{t.id}</span>
                          <StatusBadge status={t.status} tone={t.status === 'RESOLVED' ? 'green' : t.status === 'CLOSED' ? 'blue' : t.status === 'IN_PROGRESS' ? 'blue' : 'amber'} />
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{t.subject}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{t.message}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Opened {formatDate(t.createdAt)} · Last update {formatDate(t.lastUpdate)}
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

        {/* Contact side */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-emerald-700 to-teal-800 text-white">
            <CardBody>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <LifeBuoy className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold">Talk to a human</h3>
              <p className="mt-1 text-sm text-emerald-100/80">
                Our member support team is available Monday to Saturday, 8:00 AM – 6:00 PM.
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <p className="flex items-center gap-2 text-emerald-50">
                  <span className="font-semibold">Hotline:</span> (053) 555-0100
                </p>
                <p className="flex items-center gap-2 text-emerald-50">
                  <span className="font-semibold">Email:</span> membercare@HOSCOMCO.coop
                </p>
                <p className="flex items-center gap-2 text-emerald-50">
                  <span className="font-semibold">Main branch:</span> Tacloban City, Leyte
                </p>
              </div>
              <Button
                className="mt-5 w-full bg-white/15 text-white hover:bg-white/25"
                onClick={() => setTicketOpen(true)}
              >
                <Send className="h-4 w-4" /> Open a support ticket
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Community resources</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm text-slate-600">
              <p>· Annual General Assembly — Nov 15, 2026</p>
              <p>· Financial literacy seminars every Friday</p>
              <p>· Crop & small business insurance program</p>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Submit ticket modal */}
      <Modal open={ticketOpen} onClose={() => setTicketOpen(false)} title="Submit a support ticket" size="md">
        <form onSubmit={submitTicket} className="space-y-4">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" required>
            <Input placeholder="Brief summary of your concern" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message" required>
            <Textarea rows={4} placeholder="Describe the issue in detail…" value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setTicketOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              <Send className="h-4 w-4" /> Submit ticket
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SupportPage;