import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CheckCircle2, Crown, MapPin, ReceiptText, Users } from 'lucide-react';
import { groupService } from '../services/groups';
import { ClientGroup } from '../types';
import { formatCurrency, formatDate } from '../../utils/loanMath';
import {
  Amount,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  ProgressBar,
  StatusBadge,
  Table,
  Td,
  Tr,
} from '../components/ui';

const GroupsPage: React.FC = () => {
  const [group, setGroup] = useState<ClientGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const g = await groupService.myGroup();
      setGroup(g);
    } catch (err: any) {
      setError(err.message || 'Unable to load your group.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState label="Loading your group…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  if (!group || !group.id || !group.name) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Group Lending</h1>
          <p className="text-sm text-slate-500">Solidarity circles and mutual guarantee loans.</p>
        </div>
        <Card>
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="You are not in a solidarity group yet"
            description="Group lending lets you and your peers guarantee each other for larger, zero-collateral loans. Visit your branch to join or form a circle."
            action={
              <Link to="/portal/support">
                <Button size="sm">Contact us about group lending</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const gl = group.groupLoan;
  const members = Array.isArray(group.members) ? group.members : [];
  const schedule = Array.isArray(gl?.schedule) ? gl.schedule : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Group Lending</h1>
        <p className="text-sm text-slate-500">Solidarity circles and mutual guarantee loans.</p>
      </div>

      {/* Group header */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-violet-600 to-emerald-600" />
        <CardBody className="-mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-violet-50 text-violet-600 shadow-md">
                  <Users className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{group.name}</h2>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Crown className="h-3.5 w-3.5 text-amber-500" /> {group.leaderName || 'Group Leader'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {group.centerName || group.branch || '—'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <StatusBadge status={group.status || 'ACTIVE'} />
              <span className="text-sm text-slate-500">{group.memberCount || members.length} members</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {gl && (
        <Card>
          <CardHeader>
            <CardTitle>Group loan</CardTitle>
            <StatusBadge status={(Number(gl.outstandingBalance) || 0) > 0 ? 'ACTIVE' : 'COMPLETED'} />
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Total loan" value={formatCurrency(gl.totalAmount || 0)} icon={Banknote} />
              <Stat label="Outstanding" value={formatCurrency(gl.outstandingBalance || 0)} icon={ReceiptText} />
              <Stat label="Paid" value={formatCurrency(gl.paidAmount || 0)} icon={CheckCircle2} />
              <Stat
                label="Next payment"
                value={formatCurrency(gl.nextPayment || 0)}
                icon={Users}
                sub={gl.nextPaymentDate ? `Due ${formatDate(gl.nextPaymentDate)}` : undefined}
              />
            </div>
            <div className="mt-5">
              <ProgressBar value={gl.repaymentProgress || 0} max={100} showLabel label="Repayment progress" />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Circle members</CardTitle>
        </CardHeader>
        {members.length === 0 ? (
          <CardBody>
            <p className="text-sm text-slate-500">No member records listed for this circle.</p>
          </CardBody>
        ) : (
          <Table headers={['Member', 'Role', 'Contribution', 'Loan status']}>
            {members.map((m, idx) => {
              const memberName = m.name || (m as any).fullName || (m as any).borrowerName || `Member ${idx + 1}`;
              const initials = memberName
                .split(' ')
                .filter(Boolean)
                .map((p: string) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'M';

              return (
                <Tr key={m.borrowerId || idx}>
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                        {initials}
                      </span>
                      <span className="font-medium text-slate-800">{memberName}</span>
                      {m.role === 'Leader' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                    </span>
                  </Td>
                  <Td className="text-slate-500">{m.role || 'Member'}</Td>
                  <Td>
                    <StatusBadge
                      status={m.contributionStatus || 'PAID'}
                      tone={m.contributionStatus === 'PAID' ? 'green' : m.contributionStatus === 'LATE' ? 'red' : 'amber'}
                    />
                  </Td>
                  <Td className="text-slate-500">{m.loanStatus || '—'}</Td>
                </Tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* Group loan schedule */}
      {gl && schedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Group loan schedule</CardTitle>
          </CardHeader>
          <Table headers={['#', 'Due date', 'Amount due', 'Balance', 'Status']}>
            {schedule.map((s) => (
              <Tr key={s.installmentNumber}>
                <Td className="text-slate-400">{String(s.installmentNumber).padStart(2, '0')}</Td>
                <Td>{formatDate(s.dueDate)}</Td>
                <Td>
                  <Amount value={s.amountDue} />
                </Td>
                <Td className="text-slate-500">{formatCurrency(s.remainingBalance)}</Td>
                <Td>
                  <StatusBadge status={s.status} tone={s.status === 'DUE' ? 'red' : s.status === 'UPCOMING' ? 'slate' : 'green'} />
                </Td>
              </Tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; icon: React.ElementType; sub?: string }> = ({ label, value, icon: Icon, sub }) => (
  <div className="rounded-xl border border-slate-200 p-4">
    <div className="flex items-center gap-2 text-slate-400">
      <Icon className="h-4 w-4" />
      <p className="text-[11px] uppercase tracking-wide">{label}</p>
    </div>
    <p className="mt-1 text-sm font-bold tabular-nums text-slate-800">{value}</p>
    {sub && <p className="text-xs text-slate-400">{sub}</p>}
  </div>
);

export default GroupsPage;