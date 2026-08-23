import { getDb, schema } from './index';
import {
  INITIAL_BRANCHES,
  INITIAL_STAFF,
  INITIAL_LOAN_PRODUCTS,
  INITIAL_BORROWERS,
  INITIAL_LOANS,
  INITIAL_PAYMENTS,
  INITIAL_MEMBERSHIP_APPLICATIONS,
  INITIAL_UPDATE_REQUESTS,
  INITIAL_FOLLOW_UP_LOGS,
  INITIAL_SAVINGS_TRANSACTIONS,
  INITIAL_WITHDRAWAL_REQUESTS,
  INITIAL_AUDIT_LOGS,
} from '../data/initialData';

export async function seedDatabaseIfEmpty() {
  const db = getDb();
  if (!db) {
    console.warn('[Cloud SQL] Database connection unavailable. Skipping seed.');
    return;
  }

  try {
    const existingBranches = await db.select().from(schema.branches).limit(1);
    if (existingBranches.length === 0) {
      console.log('[Cloud SQL] Seeding initial cooperative database records...');

      // 1. Branches
      if (INITIAL_BRANCHES.length > 0) {
        await db.insert(schema.branches).values(INITIAL_BRANCHES as any);
      }

      // 2. Staff
      if (INITIAL_STAFF.length > 0) {
        await db.insert(schema.staff).values(INITIAL_STAFF as any);
      }

      // 3. Products
      if (INITIAL_LOAN_PRODUCTS.length > 0) {
        await db.insert(schema.loanProducts).values(INITIAL_LOAN_PRODUCTS as any);
      }

      // 4. Borrowers / Members
      if (INITIAL_BORROWERS.length > 0) {
        await db.insert(schema.borrowers).values(
          INITIAL_BORROWERS.map((b) => ({
            ...b,
            employerOrBusiness: b.employerOrBusiness || b.employer || 'Private Business',
            savingsBalance: b.savingsBalance || 1000,
            shareCapital: b.shareCapital || 15000,
          })) as any
        );

        // Also insert corresponding savings accounts
        for (const b of INITIAL_BORROWERS) {
          await db.insert(schema.savingsAccounts).values({
            id: `sav-${b.id}`,
            memberId: b.id,
            memberName: b.fullName,
            passbookNumber: `PB-${b.borrowerNumber.replace('MBR-', '')}`,
            balance: b.savingsBalance || 1000,
            maintainingBalance: 1000,
            interestRate: 1.0,
          } as any);
        }
      }

      // 5. Membership Applications
      if (INITIAL_MEMBERSHIP_APPLICATIONS.length > 0) {
        await db.insert(schema.membershipApplications).values(INITIAL_MEMBERSHIP_APPLICATIONS as any);
      }

      // 6. Member Update Requests
      if (INITIAL_UPDATE_REQUESTS.length > 0) {
        await db.insert(schema.memberUpdateRequests).values(INITIAL_UPDATE_REQUESTS as any);
      }

      // 7. Member Follow Up Logs
      if (INITIAL_FOLLOW_UP_LOGS.length > 0) {
        await db.insert(schema.memberFollowUpLogs).values(INITIAL_FOLLOW_UP_LOGS as any);
      }

      // 8. Savings Transactions
      if (INITIAL_SAVINGS_TRANSACTIONS.length > 0) {
        await db.insert(schema.savingsTransactions).values(INITIAL_SAVINGS_TRANSACTIONS as any);
      }

      // 9. Savings Withdrawal Requests
      if (INITIAL_WITHDRAWAL_REQUESTS.length > 0) {
        await db.insert(schema.savingsWithdrawalRequests).values(INITIAL_WITHDRAWAL_REQUESTS as any);
      }

      // 10. Loans
      if (INITIAL_LOANS.length > 0) {
        await db.insert(schema.loans).values(
          INITIAL_LOANS.map((l) => ({
            ...l,
            collateral: (l.collateral || l.collaterals || []) as any,
            guarantors: (l.guarantors || []) as any,
            schedule: (l.schedule || []) as any,
            underwritingReport: (l.underwritingReport || null) as any,
            creditCommitteeEval: (l.creditCommitteeEval || null) as any,
            disbursementVoucher: (l.disbursementVoucher || null) as any,
          })) as any
        );
      }

      // 11. Payments
      if (INITIAL_PAYMENTS.length > 0) {
        await db.insert(schema.payments).values(INITIAL_PAYMENTS as any);
      }

      // 12. Audit Logs
      if (INITIAL_AUDIT_LOGS.length > 0) {
        await db.insert(schema.auditLogs).values(INITIAL_AUDIT_LOGS as any);
      }

      // 13. Solidarity Groups
      const initialSolidarityGroups = [
        {
          id: 'grp-1',
          groupCode: 'SG-TAC-01',
          groupName: 'Kauswagan Solidarity Circle 1',
          centerName: 'Tacloban Downtown Center 01',
          branchId: 'b-1',
          formedDate: '2023-04-12',
          meetingDay: 'Wednesday',
          meetingTime: '08:30 AM',
          meetingLocation: 'Brgy 88 Community Multi-Purpose Hall, Tacloban',
          loanOfficerId: 's-4',
          loanOfficerName: 'Grace Mendoza',
          leaderBorrowerId: 'b-1',
          leaderName: 'Teresa Alcantara',
          leaderPhone: '+63 917 123 4567',
          members: [
            { borrowerId: 'b-1', fullName: 'Teresa Alcantara', phone: '+63 917 123 4567', role: 'Leader', activeLoanAmount: 50000, remainingBalance: 32000, savingsBalance: 18500, status: 'Good Standing', weeklyDues: 1250, isAttendingMeeting: true, meetingPaymentPaid: true },
            { borrowerId: 'b-2', fullName: 'Rolando Dela Cruz', phone: '+63 918 234 5678', role: 'Treasurer', activeLoanAmount: 40000, remainingBalance: 25000, savingsBalance: 12400, status: 'Good Standing', weeklyDues: 1000, isAttendingMeeting: true, meetingPaymentPaid: true }
          ] as any,
          totalActiveLoans: 90000,
          totalGroupSavings: 30900,
          repaymentRate: 99.2,
          solidarityFundBalance: 14500,
          jointLiabilityAgreed: true,
          status: 'Active',
        }
      ];

      await db.insert(schema.solidarityGroups).values(initialSolidarityGroups as any);

      console.log('[Database] Database successfully seeded with full HOSCOMO cooperative dataset!');
    }
  } catch (error) {
    console.error('[Database] Error seeding database:', error);
  }
}
