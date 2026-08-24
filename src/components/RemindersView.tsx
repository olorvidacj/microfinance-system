import React, { useState } from 'react';
import {
  BellRing,
  Sparkles,
  Send,
  MessageSquare,
  Mail,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Phone,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { useLoan } from '../context/LoanContext';
import { authFetch } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/loanMath';
import { Loan } from '../types';

export const RemindersView: React.FC = () => {
  const { filteredLoans, sendReminder, reminders } = useLoan();

  // Extract all pending/overdue installments across filtered loans
  const actionableInstallments = React.useMemo(() => {
    const list: Array<{
      loan: Loan;
      installmentNumber: number;
      dueDate: string;
      totalDue: number;
      status: string;
      daysOverdue: number;
    }> = [];

    filteredLoans.forEach((loan) => {
      if (loan.status === 'Disbursed' || loan.status === 'In Arrears') {
        loan.schedule.forEach((inst) => {
          if (inst.status === 'Overdue' || inst.status === 'Due Today' || inst.status === 'Pending') {
            const today = new Date();
            const due = new Date(inst.dueDate);
            const diffDays = Math.round((today.getTime() - due.getTime()) / (1000 * 3600 * 24));

            if (diffDays >= -7) {
              list.push({
                loan,
                installmentNumber: inst.installmentNumber,
                dueDate: inst.dueDate,
                totalDue: inst.totalDue - inst.amountPaid,
                status: inst.status,
                daysOverdue: Math.max(0, diffDays),
              });
            }
          }
        });
      }
    });

    return list.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [filteredLoans]);

  // Selected item for AI reminder generator
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [channel, setChannel] = useState<'SMS' | 'Facebook' | 'Phone Call' | 'Field Visit'>('SMS');
  const [urgency, setUrgency] = useState<string>('Friendly Reminder');
  const [loadingAi, setLoadingAi] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const generateAiNotice = async (item: any, selectedUrgency: string, selectedChannel: string) => {
    setLoadingAi(true);
    setSentSuccess(false);
    try {
      const response = await authFetch('/api/gemini/reminder-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrowerName: item.loan.borrowerName,
          loanNumber: item.loan.loanNumber,
          amountDue: item.totalDue,
          dueDate: item.dueDate,
          daysOverdue: item.daysOverdue,
          urgency: selectedUrgency,
          channel: selectedChannel,
        }),
      });
      const data = await response.json();
      if (data?.data?.message) {
        setGeneratedMessage(data.data.message);
      }
    } catch (e) {
      console.error(e);
      setGeneratedMessage(
        `Dear ${item.loan.borrowerName}, this is a reminder that your loan installment of $${item.totalDue} for ${item.loan.loanNumber} is due on ${item.dueDate}. Please remit payments promptly.`
      );
    } finally {
      setLoadingAi(false);
    }
  };

  const handleOpenAiModal = (item: any) => {
    setSelectedItem(item);
    const defaultUrgency =
      item.daysOverdue > 14 ? 'Final Demand Notice' : item.daysOverdue > 0 ? 'Urgent Overdue' : 'Friendly Reminder';
    setUrgency(defaultUrgency);
    generateAiNotice(item, defaultUrgency, channel);
  };

  const handleTransmitReminder = () => {
    if (!selectedItem) return;
    sendReminder({
      borrowerId: selectedItem.loan.borrowerId,
      borrowerName: selectedItem.loan.borrowerName,
      borrowerPhone: selectedItem.loan.borrowerPhone,
      borrowerEmail: `${selectedItem.loan.borrowerName.toLowerCase().replace(' ', '.')}@example.com`,
      loanId: selectedItem.loan.id,
      loanNumber: selectedItem.loan.loanNumber,
      amountDue: selectedItem.totalDue,
      dueDate: selectedItem.dueDate,
      daysOverdue: selectedItem.daysOverdue,
      channel,
      messagePreview: generatedMessage,
    });
    setSentSuccess(true);
    setTimeout(() => {
      setSelectedItem(null);
      setSentSuccess(false);
    }, 1200);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Repayment Reminders & AI Collections
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Automated schedule tracking, delinquency follow-ups, and AI-personalized collection notices.
          </p>
        </div>
      </div>

      {/* Two Column Layout: Actionable Due Queue & Dispatched History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actionable Installments Queue (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                  Upcoming & Delinquent Due Queue
                </h3>
                <p className="text-xs text-gray-500">Accounts requiring payment engagement</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
              {actionableInstallments.length} Due Accounts
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {actionableInstallments.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                All active loan schedules are up to date with zero overdue accounts!
              </div>
            ) : (
              actionableInstallments.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 hover:bg-gray-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={item.loan.borrowerAvatar}
                      alt={item.loan.borrowerName}
                      className="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0"
                    />
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{item.loan.borrowerName}</div>
                      <div className="text-xs text-gray-500">
                        {item.loan.loanNumber} â€¢ Installment #{item.installmentNumber}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px]">
                        <span className="font-medium text-gray-700">Due: {formatDate(item.dueDate)}</span>
                        {item.daysOverdue > 0 ? (
                          <span className="px-1.5 py-0.2 rounded font-semibold bg-rose-100 text-rose-700">
                            {item.daysOverdue} Days Overdue
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded font-semibold bg-emerald-100 text-emerald-700">
                            Due in {Math.abs(item.daysOverdue)} Days
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-gray-400">Amount Due</div>
                      <div className="text-sm font-bold text-gray-900 font-mono">
                        {formatCurrency(item.totalDue)}
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenAiModal(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Draft AI Notice</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transmission History Feed (1 col) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Transmission History</h3>
                <p className="text-xs text-gray-500">Logged notices & SMS dispatches</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {reminders.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-xs">
                  No reminders dispatched in this session yet.
                </div>
              ) : (
                reminders.map((rem) => (
                  <div key={rem.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-semibold text-gray-900">
                      <span>{rem.borrowerName}</span>
                      <span className="text-[10px] text-emerald-600 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {rem.status} â€¢ {rem.sentAt}
                      </span>
                    </div>
                    <div className="text-gray-500 text-[11px]">
                      {rem.channel} for {rem.loanNumber} ({formatCurrency(rem.amountDue)})
                    </div>
                    <p className="text-[11px] text-gray-600 line-clamp-2 bg-white p-2 rounded-lg border border-gray-100 italic">
                      "{rem.messagePreview}"
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Reminder Drafter Dialog */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">AI Repayment Notice Assistant</h3>
                  <p className="text-xs text-gray-500">
                    Recipient: {selectedItem.loan.borrowerName} â€¢ {selectedItem.loan.loanNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {/* Channels & Urgency selectors */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Notice Channel</label>
                <select
                  value={channel}
                  onChange={(e: any) => {
                    setChannel(e.target.value);
                    generateAiNotice(selectedItem, urgency, e.target.value);
                  }}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl"
                >
                  <option value="SMS">SMS (Cellular Text Message)</option>
                  <option value="Facebook">Facebook Messenger</option>
                  <option value="Phone Call">Telephone / Direct Voice Call</option>
                  <option value="Field Visit">Field Officer Visit (Barangay)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Tone & Severity</label>
                <select
                  value={urgency}
                  onChange={(e) => {
                    setUrgency(e.target.value);
                    generateAiNotice(selectedItem, e.target.value, channel);
                  }}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl"
                >
                  <option value="Friendly Reminder">Friendly Reminder (Gentle)</option>
                  <option value="Due Today Notice">Due Today Notice (Neutral)</option>
                  <option value="Urgent Overdue">Urgent Overdue (Strict)</option>
                  <option value="Final Demand Notice">Final Demand Notice (Legal / Arrears)</option>
                </select>
              </div>
            </div>

            {/* Generated Message Box */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                <span>Custom Generated Notice Message</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => generateAiNotice(selectedItem, urgency, channel)}
                    disabled={loadingAi}
                    className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-normal"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingAi ? 'animate-spin' : ''}`} />
                    <span>Regenerate</span>
                  </button>
                  <button
                    onClick={handleCopyText}
                    className="text-gray-500 hover:text-gray-700 flex items-center gap-1 font-normal"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {loadingAi ? (
                <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center text-gray-500 text-xs">
                  <Sparkles className="w-6 h-6 mx-auto text-blue-600 animate-pulse mb-2" />
                  Drafting customized repayment notice using Gemini AI...
                </div>
              ) : (
                <textarea
                  rows={5}
                  value={generatedMessage}
                  onChange={(e) => setGeneratedMessage(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-sans text-gray-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="py-2 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>

              <button
                onClick={handleTransmitReminder}
                disabled={loadingAi || sentSuccess}
                className={`py-2 px-5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition shadow-sm ${
                  sentSuccess
                    ? 'bg-emerald-600'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                }`}
              >
                {sentSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Transmitted!</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Notice via {channel}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
