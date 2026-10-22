import { pgTable, text, timestamp, boolean, integer, doublePrecision, jsonb, pgSchema, numeric, date, bigint, uuid } from "drizzle-orm/pg-core";


export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
  staffRole: text("staff_role"),
  staffId: text("staff_id"),
  borrowerId: text("borrower_id"),
  phone: text("phone"),
  avatar: text("avatar"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const idSequences = pgTable("id_sequences", {
  name: text("name").primaryKey(),
  year: integer("year").notNull(),
  lastValue: integer("last_value").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const branches = pgTable("branches", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  managerName: text("manager_name").notNull(),
  managerEmail: text("manager_email").notNull(),
  activeDisbursedPool: doublePrecision("active_disbursed_pool").default(0),
  cashVaultBalance: doublePrecision("cash_vault_balance").default(0),
  activeLoansCount: integer("active_loans_count").default(0),
  color: text("color").default("#3B82F6"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const staff = pgTable("staff", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  assignedBranchId: text("assigned_branch_id").notNull(),
  title: text("title").notNull(),
  avatar: text("avatar").notNull(),
  committee: text("committee"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Money and rates are exact numerics (0025). This declaration reads them as
// JS numbers for display-only legacy readers; the lending service reads the
// same tables through src/lending/tables.ts, which keeps them as strings.
export const loanProducts = pgTable("loan_products", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  interestRate: numeric("interest_rate", { precision: 7, scale: 4, mode: "number" }).notNull(),
  // FLAT | DIMINISHING
  interestType: text("interest_type").notNull(),
  minAmount: numeric("min_amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  maxAmount: numeric("max_amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  minTermMonths: integer("min_term_months").notNull(),
  maxTermMonths: integer("max_term_months").notNull(),
  // WEEKLY | BI_WEEKLY | MONTHLY
  repaymentFrequency: text("repayment_frequency").notNull(),
  fees: jsonb("fees").notNull(),
  latePenaltyRate: numeric("late_penalty_rate", { precision: 7, scale: 4, mode: "number" }).notNull(),
  earlySettlementRebateRate: numeric("early_settlement_rebate_rate", { precision: 7, scale: 4, mode: "number" }),
  requiresCollateral: boolean("requires_collateral").default(false),
  requiresGuarantor: boolean("requires_guarantor").default(false),
  lendingType: text("lending_type").notNull(),
  status: text("status").notNull(),
  description: text("description"),
  badgeColor: text("badge_color").default("#3B82F6"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const borrowers = pgTable("borrowers", {
  id: text("id").primaryKey(),
  borrowerNumber: text("borrower_number").notNull().unique(),
  fullName: text("full_name").notNull(),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  lastName: text("last_name"),
  suffix: text("suffix"),
  hasNoMiddleName: boolean("has_no_middle_name").default(false),
  idNumber: text("id_number").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  gender: text("gender").notNull(),
  civilStatus: text("civil_status").notNull(),
  address: text("address").notNull(),
  facebookAccount: text("facebook_account"),
  branchId: text("branch_id").notNull(),
  employmentStatus: text("employment_status").notNull(),
  employerOrBusiness: text("employer_or_business").notNull(),
  occupation: text("occupation").notNull(),
  monthlyIncome: doublePrecision("monthly_income").notNull(),
  monthlyExpenses: doublePrecision("monthly_expenses").notNull(),
  creditScore: integer("credit_score").notNull(),
  creditTier: text("credit_tier").notNull(),
  emailVerified: integer("email_verified").default(0),
  emailVerifiedAt: text("email_verified_at"),
  kycStatus: text("kyc_status").notNull(),
  memberStatus: text("member_status").notNull(),
  membershipDate: text("membership_date").notNull(),
  profileCompleted: boolean("profile_completed").default(false),
  profileCompletedAt: text("profile_completed_at"),
  existingMemberId: text("existing_member_id"),
  barangay: text("barangay"),
  cityMunicipality: text("city_municipality"),
  province: text("province"),
  sourceOfIncome: text("source_of_income"),
  region: text("region"),
  regionCode: text("region_code"),
  provinceCode: text("province_code"),
  cityCode: text("city_code"),
  barangayCode: text("barangay_code"),
  postalCode: text("postal_code"),
  idType: text("id_type"),
  registrationChannel: text("registration_channel"),
  registeredBy: text("registered_by"),
  savingsBalance: doublePrecision("savings_balance").default(0),
  shareCapital: doublePrecision("share_capital").default(0),
  activeLoansCount: integer("active_loans_count").default(0),
  totalBorrowed: doublePrecision("total_borrowed").default(0),
  totalRepaid: doublePrecision("total_repaid").default(0),
  avatar: text("avatar").notNull(),
  joinedDate: text("joined_date").notNull(),
  lastActivityDate: text("last_activity_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const membershipApplications = pgTable("membership_applications", {
  id: text("id").primaryKey(),
  applicationNumber: text("application_number").notNull(),
  applicantName: text("applicant_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  civilStatus: text("civil_status").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  facebookAccount: text("facebook_account"),
  address: text("address").notNull(),
  occupation: text("occupation").notNull(),
  employerOrBusiness: text("employer_or_business").notNull(),
  monthlyIncome: doublePrecision("monthly_income").notNull(),
  branchId: text("branch_id").notNull(),
  submittedDate: text("submitted_date").notNull(),
  currentStep: text("current_step").notNull(),
  validIdAttached: boolean("valid_id_attached").default(true),
  proofOfIncomeAttached: boolean("proof_of_income_attached").default(true),
  twoByTwoPhotoAttached: boolean("two_by_two_photo_attached").default(true),
  membershipFeePaid: boolean("membership_fee_paid").default(false),
  initialShareCapital: doublePrecision("initial_share_capital").default(2000),
  encodedBy: text("encoded_by"),
  encodedDate: text("encoded_date"),
  backgroundInvestigation: jsonb("background_investigation"),
  bodReviewDate: text("bod_review_date"),
  bodApprovedBy: jsonb("bod_approved_by"),
  bodNotes: text("bod_notes"),
  rejectionReason: text("rejection_reason"),
  targetCompletionDate: text("target_completion_date").notNull(),
  createdBorrowerId: text("created_borrower_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memberUpdateRequests = pgTable("member_update_requests", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  memberNumber: text("member_number").notNull(),
  branchId: text("branch_id").notNull(),
  requestDate: text("request_date").notNull(),
  channel: text("channel").notNull(),
  fieldToUpdate: text("field_to_update").notNull(),
  oldValue: text("old_value").notNull(),
  newValue: text("new_value").notNull(),
  reason: text("reason").notNull(),
  supportingDocType: text("supporting_doc_type").notNull(),
  supportingDocFileName: text("supporting_doc_file_name"),
  supportingDocVerified: boolean("supporting_doc_verified").default(false),
  status: text("status").notNull().default("Pending"),
  reviewedBy: text("reviewed_by"),
  reviewDate: text("review_date"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memberFollowUpLogs = pgTable("member_follow_up_logs", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  memberNumber: text("member_number").notNull(),
  branchId: text("branch_id").notNull(),
  date: text("date").notNull(),
  contactChannel: text("contact_channel").notNull(),
  conductedBy: text("conducted_by").notNull(),
  hasOutstandingLoan: boolean("has_outstanding_loan").default(false),
  outstandingLoanAmount: doublePrecision("outstanding_loan_amount").default(0),
  purpose: text("purpose").notNull(),
  memberResponse: text("member_response").notNull(),
  nextFollowUpDate: text("next_follow_up_date"),
  actionTaken: text("action_taken").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Exact numerics (0027), read as numbers for display; src/savings reads them as strings.
export const savingsAccounts = pgTable("savings_accounts", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  passbookNumber: text("passbook_number").notNull(),
  balance: numeric("balance", { precision: 14, scale: 2, mode: "number" }).notNull(),
  maintainingBalance: numeric("maintaining_balance", { precision: 14, scale: 2, mode: "number" }),
  interestRate: numeric("interest_rate", { precision: 7, scale: 4, mode: "number" }),
  createdAt: timestamp("created_at").defaultNow(),
  productId: text("product_id").notNull(),
  // ACTIVE | DORMANT | FROZEN | CLOSED
  status: text("status").notNull(),
  branchId: text("branch_id"),
  openedAt: timestamp("opened_at", { withTimezone: true, mode: "string" }),
  closedAt: timestamp("closed_at", { withTimezone: true, mode: "string" }),
  statusReason: text("status_reason"),
  lastActivityDate: date("last_activity_date", { mode: "string" }),
  maturityDate: date("maturity_date", { mode: "string" }),
  groupId: text("group_id"),
});

export const savingsTransactions = pgTable("savings_transactions", {
  id: text("id").primaryKey(),
  savingsAccountId: text("savings_account_id").notNull(),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  transactionNumber: text("transaction_number").notNull(),
  date: text("date").notNull(),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  balanceBefore: numeric("balance_before", { precision: 14, scale: 2, mode: "number" }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 14, scale: 2, mode: "number" }).notNull(),
  processedBy: text("processed_by").notNull(),
  notes: text("notes"),
  officialReceiptNumber: text("official_receipt_number"),
  createdAt: timestamp("created_at").defaultNow(),
  kind: text("kind").notNull(),
  signedAmount: numeric("signed_amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  method: text("method"),
  reference: text("reference"),
  destinationAccount: text("destination_account"),
  journalEntryId: uuid("journal_entry_id"),
  idempotencyKey: text("idempotency_key"),
  interestPeriod: text("interest_period"),
  branchId: text("branch_id"),
  postedBy: text("posted_by"),
  withdrawalRequestId: text("withdrawal_request_id"),
  sequence: bigint("sequence", { mode: "number" }),
});

export const savingsWithdrawalRequests = pgTable("savings_withdrawal_requests", {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    memberId: text("member_id").notNull(),
    memberName: text("member_name").notNull(),
    branchId: text("branch_id").notNull(),
    // The savings account this withdrawal was raised against (0015).
    // Nullable: pre-0015 rows and requests whose member holds more than
    // one passbook are deliberately left unresolved rather than guessed.
    accountId: text("account_id"),
    currentBalance: numeric("current_balance", { precision: 14, scale: 2, mode: "number" }).notNull(),
    // Balance of that specific account when the request was raised.
    // Distinct from currentBalance, which is the member-wide total, and
    // from remainingBalanceAfter, which is the post-debit figure.
    accountBalanceBefore: numeric("account_balance_before", { precision: 14, scale: 2, mode: "number" }),
    requestedAmount: numeric("requested_amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  maintainingBalance: numeric("maintaining_balance", { precision: 14, scale: 2, mode: "number" }).default(1000),
  remainingBalanceAfter: numeric("remaining_balance_after", { precision: 14, scale: 2, mode: "number" }).notNull(),
  requestDate: text("request_date").notNull(),
  reason: text("reason").notNull(),
  tellerName: text("teller_name").notNull(),
  tellerRecordedDate: text("teller_recorded_date").notNull(),
  status: text("status").notNull().default("PENDING"),
  approvedByManager: text("approved_by_manager"),
  approvalDate: text("approval_date"),
  disbursedDate: text("disbursed_date"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  // CASH_PICKUP | BANK_TRANSFER | E_WALLET
  destination: text("destination"),
  destinationAccount: text("destination_account"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true, mode: "string" }),
  transactionId: text("transaction_id"),
});

export const interestCreditLogs = pgTable("interest_credit_logs", {
  id: text("id").primaryKey(),
  periodMonth: text("period_month").notNull(),
  calculationDate: text("calculation_date").notNull(),
  annualRate: doublePrecision("annual_rate").default(1.0),
  totalMembersCredited: integer("total_members_credited").notNull(),
  totalInterestDistributed: doublePrecision("total_interest_distributed").notNull(),
  executedBy: text("executed_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const loans = pgTable("loans", {
  id: text("id").primaryKey(),
  loanNumber: text("loan_number").notNull().unique(),
  borrowerId: text("borrower_id").notNull(),
  borrowerName: text("borrower_name").notNull(),
  borrowerPhone: text("borrower_phone").notNull(),
  borrowerAvatar: text("borrower_avatar"),
  branchId: text("branch_id").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  principalAmount: numeric("principal_amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  interestRate: numeric("interest_rate", { precision: 7, scale: 4, mode: "number" }).notNull(),
  interestType: text("interest_type").notNull(),
  repaymentFrequency: text("repayment_frequency").notNull(),
  termMonths: integer("term_months").notNull(),
  totalInstallments: integer("total_installments").notNull(),
  processingFee: numeric("processing_fee", { precision: 14, scale: 2, mode: "number" }).notNull(),
  totalInterest: numeric("total_interest", { precision: 14, scale: 2, mode: "number" }).notNull(),
  totalPayable: numeric("total_payable", { precision: 14, scale: 2, mode: "number" }).notNull(),
  totalPaid: numeric("total_paid", { precision: 14, scale: 2, mode: "number" }).notNull().default(0),
  remainingBalance: numeric("remaining_balance", { precision: 14, scale: 2, mode: "number" }).notNull(),
  status: text("status").notNull(),
  coopStep: text("coop_step").notNull(),
  applicationDate: text("application_date").notNull(),
  startDate: text("start_date"),
  approvalDate: text("approval_date"),
  disbursedDate: text("disbursed_date"),
  nextPaymentDate: text("next_payment_date"),
  maturityDate: text("maturity_date").notNull(),
  loanOfficerId: text("loan_officer_id"),
  loanOfficerName: text("loan_officer_name"),
  purpose: text("purpose").notNull(),
  collateral: jsonb("collateral"),
  guarantors: jsonb("guarantors"),
  schedule: jsonb("schedule"),
  underwritingReport: jsonb("underwriting_report"),
  creditCommitteeEval: jsonb("credit_committee_eval"),
  disbursementVoucher: jsonb("disbursement_voucher"),
  lastPaymentDate: text("last_payment_date"),
  daysInArrears: integer("days_in_arrears").default(0),
  isIrregularAccount: boolean("is_irregular_account").default(false),
  totalLatePenaltiesCharged: numeric("total_late_penalties_charged", { precision: 14, scale: 2, mode: "number" }).default(0),
  totalRebatesAwarded: numeric("total_rebates_awarded", { precision: 14, scale: 2, mode: "number" }).default(0),
  disbursementMethod: text("disbursement_method"),
  disbursementAccount: text("disbursement_account"),
  officerInCharge: text("officer_in_charge"),
  // 0025: processing_fee holds the total of all fees; fees has the breakdown.
  fees: jsonb("fees").notNull(),
  netProceeds: numeric("net_proceeds", { precision: 14, scale: 2, mode: "number" }),
  installmentAmount: numeric("installment_amount", { precision: 14, scale: 2, mode: "number" }),
  penaltyRate: numeric("penalty_rate", { precision: 7, scale: 4, mode: "number" }),
  lendingType: text("lending_type").notNull(),
  groupId: text("group_id"),
  applicationChannel: text("application_channel"),
  requestKey: text("request_key"),
  createdBy: text("created_by"),
  submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "string" }),
  reviewedBy: text("reviewed_by"),
  reviewedByName: text("reviewed_by_name"),
  reviewStartedAt: timestamp("review_started_at", { withTimezone: true, mode: "string" }),
  decidedBy: text("decided_by"),
  decidedByName: text("decided_by_name"),
  decidedAt: timestamp("decided_at", { withTimezone: true, mode: "string" }),
  decisionReason: text("decision_reason"),
  returnedReason: text("returned_reason"),
  cancellationReason: text("cancellation_reason"),
  closedAt: timestamp("closed_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
});

// Amounts are exact numerics (0026), read as JS numbers here for display;
// src/lending/tables.ts reads them as strings for posting.
export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  receiptNumber: text("receipt_number").notNull().unique(),
  loanId: text("loan_id").notNull(),
  loanNumber: text("loan_number").notNull(),
  borrowerId: text("borrower_id").notNull(),
  borrowerName: text("borrower_name").notNull(),
  branchId: text("branch_id").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  paymentDate: text("payment_date").notNull(),
  // CASH | BANK_TRANSFER | E_WALLET
  paymentMethod: text("payment_method").notNull(),
  transactionReference: text("transaction_reference").notNull(),
  collectedBy: text("collected_by").notNull(),
  principalPortion: numeric("principal_portion", { precision: 14, scale: 2, mode: "number" }).notNull(),
  interestPortion: numeric("interest_portion", { precision: 14, scale: 2, mode: "number" }).notNull(),
  penaltyPortion: numeric("penalty_portion", { precision: 14, scale: 2, mode: "number" }).notNull(),
  rebateDiscount: numeric("rebate_discount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  paymentScheduleType: text("payment_schedule_type").notNull(),
  isAdvancePayment: boolean("is_advance_payment").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  // POSTED | REVERSED
  status: text("status").notNull(),
  paymentKind: text("payment_kind"),
  excessAmount: numeric("excess_amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  allocation: jsonb("allocation"),
  idempotencyKey: text("idempotency_key"),
  journalEntryId: uuid("journal_entry_id"),
  proofId: text("proof_id"),
  postedBy: text("posted_by"),
  postedAt: timestamp("posted_at", { withTimezone: true, mode: "string" }),
  reversalReference: text("reversal_reference"),
  reversalJournalEntryId: uuid("reversal_journal_entry_id"),
  reversedAt: timestamp("reversed_at", { withTimezone: true, mode: "string" }),
  reversedBy: text("reversed_by"),
  reversedByName: text("reversed_by_name"),
  reversalReason: text("reversal_reason"),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  action: text("action").notNull(),
  details: text("details").notNull(),
  performedBy: text("performed_by").notNull(),
  branchId: text("branch_id").notNull(),
  type: text("type").notNull(),
  userName: text("user_name"),
  userRole: text("user_role"),
  targetType: text("target_type"),
  targetId: text("target_id"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const solidarityGroups = pgTable("solidarity_groups", {
  id: text("id").primaryKey(),
  groupCode: text("group_code").notNull().unique(),
  groupName: text("group_name").notNull(),
  centerName: text("center_name").notNull(),
  branchId: text("branch_id").notNull(),
  formedDate: text("formed_date").notNull(),
  meetingDay: text("meeting_day").notNull(),
  meetingTime: text("meeting_time").notNull(),
  meetingLocation: text("meeting_location").notNull(),
  loanOfficerId: text("loan_officer_id").notNull(),
  loanOfficerName: text("loan_officer_name").notNull(),
  // 0028: copies of the LEADER row in group_members; empty while forming.
  leaderBorrowerId: text("leader_borrower_id"),
  leaderName: text("leader_name"),
  leaderPhone: text("leader_phone"),
  // Superseded by group_members (0028); kept for rollback, no longer written.
  members: jsonb("members"),
  totalActiveLoans: doublePrecision("total_active_loans").default(0),
  totalGroupSavings: doublePrecision("total_group_savings").default(0),
  repaymentRate: doublePrecision("repayment_rate").default(100),
  // Exact (0028): cache of group_fund_transactions.
  solidarityFundBalance: numeric("solidarity_fund_balance", { precision: 14, scale: 2, mode: "number" }).notNull().default(0),
  jointLiabilityAgreed: boolean("joint_liability_agreed").default(true),
  // FORMING | ACTIVE | SUSPENDED | DISSOLVED
  status: text("status").notNull().default("FORMING"),
  createdAt: timestamp("created_at").defaultNow(),
  meetingFrequency: text("meeting_frequency").notNull().default("WEEKLY"),
  arrearsThresholdDays: integer("arrears_threshold_days").notNull().default(7),
  statusReason: text("status_reason"),
  createdBy: text("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  dissolvedAt: timestamp("dissolved_at", { withTimezone: true, mode: "string" }),
});

export const financialTransactions = pgTable("financial_transactions", {
  id: text("id").primaryKey(),
  referenceNumber: text("reference_number").notNull(),
  clientId: text("client_id").notNull(),
  clientName: text("client_name"),
  accountOrLoanId: text("account_or_loan_id").notNull(),
  accountOrLoanType: text("account_or_loan_type").default("General"),
  branchId: text("branch_id"),
  transactionType: text("transaction_type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  transactionDate: text("transaction_date").notNull(),
  paymentMethod: text("payment_method").notNull(),
  processedBy: text("processed_by").notNull(),
  processedByRole: text("processed_by_role"),
  status: text("status").notNull(),
  notes: text("notes"),
  reversalOfTxnId: text("reversal_of_txn_id"),
  reversedByTxnId: text("reversed_by_txn_id"),
  metadata: jsonb("metadata"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  docNumber: text("doc_number").notNull(),
  branchId: text("branch_id").notNull(),
  clientId: text("client_id"),
  clientName: text("client_name"),
  loanId: text("loan_id"),
  loanNumber: text("loan_number"),
    docName: text("doc_name").notNull(),
    docType: text("doc_type").notNull(),
    // fileUrl is overloaded: it may hold a durable object path for new
    // uploads or a public/signed URL for anything seeded earlier. A
    // signed URL expires, so it must never be treated as the record of
    // where the bytes live.
    fileUrl: text("file_url"),
    // The non-expiring path inside the private bucket (0015).
    storagePath: text("storage_path"),
    // Original uploaded filename, for display. Not derivable from docName,
    // which is the human label.
    fileName: text("file_name"),
    uploadedBy: text("uploaded_by").notNull(),
    status: text("status").notNull().default("Active"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
  });

  // ---------------------------------------------------------------------------
  // Payment proofs (0016)
  //
  // A client paying a loan uploads a receipt. The bytes live in the private
  // kyc-documents bucket and a `documents` row records them, but a documents
  // row is a generic file record: it carries no amount, no payer and no
  // verification decision, so there was no queue a teller could actually
  // work. This table is that queue. `documents` keeps holding the bytes;
  // a proof row holds the claim made about them.
  //
  // A proof is a CLAIM awaiting verification, never a payment. There is
  // deliberately no FK to `payments`: approving a proof is what creates
  // the payment, not the other way round. The legacy schema has no foreign
  // keys on any financial table, so documentId is a soft reference.
  // ---------------------------------------------------------------------------
  export const paymentProofs = pgTable("payment_proofs", {
    id: text("id").primaryKey(),
    // the claim
    borrowerId: text("borrower_id").notNull(),
    loanId: text("loan_id").notNull(),
    loanNumber: text("loan_number"),
    amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
    currency: text("currency").notNull().default("PHP"),
    paymentMethod: text("payment_method").notNull(),
    paymentDate: text("payment_date").notNull(),
    referenceNumber: text("reference_number"),
    notes: text("notes"),
    // the evidence
    documentId: text("document_id"),
    storagePath: text("storage_path"),
    fileName: text("file_name"),
    // branch routing
    branchId: text("branch_id").notNull(),
    submittedBy: text("submitted_by"),
    submittedAt: text("submitted_at").notNull(),
    // the decision
    status: text("status").notNull().default("PENDING_REVIEW"),
    reviewedBy: text("reviewed_by"),
    reviewedByName: text("reviewed_by_name"),
    reviewedAt: text("reviewed_at"),
    rejectionReason: text("rejection_reason"),
    // set only once a verified payment row exists
    paymentId: text("payment_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  });
  // Indexes (idx_payment_proofs_queue, idx_payment_proofs_borrower) are
  // created by 0016. No table in this file declares indexes inline; the
  // hand-authored SQL in database/migrations owns them.

// ---------------------------------------------------------------------------
// KYC (Know Your Customer) tables
// ---------------------------------------------------------------------------

export const kycSubmissions = pgTable("kyc_submissions", {
  id: text("id").primaryKey(),
  borrowerId: text("borrower_id").notNull(),
  status: text("status").notNull().default("NOT_STARTED"),
  personalInfo: jsonb("personal_info"),
  address: jsonb("address"),
  employment: jsonb("employment"),
  contactInfo: jsonb("contact_info"),
  governmentId: jsonb("government_id"),
  declarations: jsonb("declarations"),
  currentStep: integer("current_step").default(0),
  correctionDetails: jsonb("correction_details"),
  submittedAt: text("submitted_at"),
  reviewedAt: text("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  reviewedByName: text("reviewed_by_name"),
  correctionReason: text("correction_reason"),
  rejectionReason: text("rejection_reason"),
  verifiedAt: text("verified_at"),
  referenceNumber: text("reference_number"),
  submissionCount: integer("submission_count").notNull().default(0),
  idType: text("id_type"),
  idDetails: jsonb("id_details"),
  ocrResult: jsonb("ocr_result"),
  faceCheck: jsonb("face_check"),
  discrepancies: jsonb("discrepancies"),
  discrepancyNote: text("discrepancy_note"),
  consents: jsonb("consents"),
  correctionSections: jsonb("correction_sections"),
  documentsRequested: jsonb("documents_requested"),
  resubmissionAllowed: boolean("resubmission_allowed"),
  appealAllowed: boolean("appeal_allowed"),
  decisionReason: text("decision_reason"),
  suspensionReason: text("suspension_reason"),
  claimedBy: text("claimed_by"),
  claimedByName: text("claimed_by_name"),
  claimedAt: text("claimed_at"),
  lastIdempotencyKey: text("last_idempotency_key"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const kycDocuments = pgTable("kyc_documents", {
  id: text("id").primaryKey(),
  kycSubmissionId: text("kyc_submission_id").notNull(),
  borrowerId: text("borrower_id").notNull(),
  documentType: text("document_type").notNull(),
  documentName: text("document_name").notNull(),
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  storagePath: text("storage_path"),
  fileSize: text("file_size"),
  mimeType: text("mime_type"),
  status: text("status").notNull().default("PENDING"),
  rejectionReason: text("rejection_reason"),
  verifiedBy: text("verified_by"),
  verifiedAt: text("verified_at"),
  documentKind: text("document_kind"),
  side: text("side"),
  sha256: text("sha256"),
  quality: jsonb("quality"),
  storageBackend: text("storage_backend"),
  width: integer("width"),
  height: integer("height"),
  uploadedBy: text("uploaded_by"),
  supersededAt: text("superseded_at"),
  createdAt: text("created_at").notNull(),
});

export const kycAuditLog = pgTable("kyc_audit_log", {
  id: text("id").primaryKey(),
  borrowerId: text("borrower_id").notNull(),
  kycSubmissionId: text("kyc_submission_id"),
  staffUserId: text("staff_user_id"),
  staffName: text("staff_name"),
  action: text("action").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  reason: text("reason"),
  actorType: text("actor_type"),
  actorUserId: text("actor_user_id"),
  metadata: jsonb("metadata"),
  createdAt: text("created_at").notNull(),
});

/** Append-only: every submitted version of an application, frozen as the reviewer saw it (0023). */
export const kycSubmissionSnapshots = pgTable("kyc_submission_snapshots", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull(),
  borrowerId: text("borrower_id").notNull(),
  version: integer("version").notNull(),
  referenceNumber: text("reference_number"),
  snapshot: jsonb("snapshot").notNull(),
  sha256: text("sha256").notNull(),
  submittedAt: text("submitted_at").notNull(),
  createdAt: text("created_at").notNull(),
});

/** One-time email codes; code and token are stored as hashes (0024). */
export const emailVerifications = pgTable("email_verifications", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  purpose: text("purpose").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  tokenHash: text("token_hash"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  consumedBy: text("consumed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kycRequiredDocuments = pgTable("kyc_required_documents", {
  id: text("id").primaryKey(),
  documentType: text("document_type").notNull(),
  documentName: text("document_name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const branchNotifications = pgTable("branch_notifications", {
  id: text("id").primaryKey(),
  branchId: text("branch_id").notNull(),
  targetStaffId: text("target_staff_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedType: text("related_type"),
  relatedId: text("related_id"),
  /** STAFF: the branch feed. CLIENT: the member feed of borrowerId (0024). */
  audience: text("audience").notNull().default("STAFF"),
  borrowerId: text("borrower_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// Lending (0025). Numerics are exact decimal strings here.
// ---------------------------------------------------------------------------

export const loanSchedule = pgTable("loan_schedule", {
  id: text("id").primaryKey(),
  loanId: text("loan_id").notNull(),
  installmentNumber: integer("installment_number").notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  principalDue: numeric("principal_due", { precision: 14, scale: 2 }).notNull(),
  interestDue: numeric("interest_due", { precision: 14, scale: 2 }).notNull(),
  totalDue: numeric("total_due", { precision: 14, scale: 2 }).notNull(),
  principalPaid: numeric("principal_paid", { precision: 14, scale: 2 }).notNull(),
  interestPaid: numeric("interest_paid", { precision: 14, scale: 2 }).notNull(),
  penaltyPaid: numeric("penalty_paid", { precision: 14, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 14, scale: 2 }).notNull(),
  penaltyDue: numeric("penalty_due", { precision: 14, scale: 2 }).notNull(),
  // PENDING | PARTIAL | PAID | OVERDUE
  status: text("status").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const loanStatusHistory = pgTable("loan_status_history", {
  id: text("id").primaryKey(),
  loanId: text("loan_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id"),
  actorName: text("actor_name"),
  actorRole: text("actor_role"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const loanApprovalLimits = pgTable("loan_approval_limits", {
  role: text("role").primaryKey(),
  maxAmount: numeric("max_amount", { precision: 14, scale: 2 }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedBy: text("updated_by"),
});

export const loanDisbursements = pgTable("loan_disbursements", {
  id: text("id").primaryKey(),
  loanId: text("loan_id").notNull(),
  branchId: text("branch_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  receiptNumber: text("receipt_number").notNull(),
  // CASH | BANK_TRANSFER | E_WALLET
  method: text("method").notNull(),
  referenceNumber: text("reference_number"),
  destinationAccount: text("destination_account"),
  disbursementDate: date("disbursement_date", { mode: "string" }).notNull(),
  grossAmount: numeric("gross_amount", { precision: 14, scale: 2 }).notNull(),
  totalFees: numeric("total_fees", { precision: 14, scale: 2 }).notNull(),
  netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull(),
  fees: jsonb("fees").notNull(),
  journalEntryId: uuid("journal_entry_id").notNull(),
  disbursedBy: text("disbursed_by").notNull(),
  disbursedByName: text("disbursed_by_name").notNull(),
  disbursedByRole: text("disbursed_by_role").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

// Double-entry ledger (0006, ensured by 0025).
export const ledgerAccounts = pgTable("accounts", {
  accountId: uuid("account_id").primaryKey(),
  accountCode: text("account_code").notNull(),
  accountName: text("account_name").notNull(),
  accountType: text("account_type").notNull(),
  normalBalance: text("normal_balance").notNull(),
  status: text("status").notNull(),
});

export const journalEntries = pgTable("journal_entries", {
  journalEntryId: uuid("journal_entry_id").primaryKey().defaultRandom(),
  entryDate: date("entry_date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  referenceNumber: text("reference_number"),
  sourceModule: text("source_module").notNull(),
  sourceRef: text("source_ref"),
  branchId: text("branch_id"),
  postedBy: text("posted_by"),
  postedByName: text("posted_by_name"),
  idempotencyKey: text("idempotency_key"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const journalEntryLines = pgTable("journal_entry_lines", {
  lineId: uuid("line_id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull(),
  lineNumber: integer("line_number").notNull(),
  accountId: uuid("account_id").notNull(),
  debit: numeric("debit", { precision: 14, scale: 2 }).notNull(),
  credit: numeric("credit", { precision: 14, scale: 2 }).notNull(),
  memo: text("memo"),
});

export const loanPenalties = pgTable("loan_penalties", {
  id: text("id").primaryKey(),
  loanId: text("loan_id").notNull(),
  scheduleId: text("schedule_id").notNull(),
  installmentNumber: integer("installment_number").notNull(),
  period: integer("period").notNull(),
  assessedOn: date("assessed_on", { mode: "string" }).notNull(),
  baseAmount: numeric("base_amount", { precision: 14, scale: 2 }).notNull(),
  rate: numeric("rate", { precision: 7, scale: 4 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  journalEntryId: uuid("journal_entry_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const savingsProducts = pgTable("savings_products", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  // REGULAR | COMPULSORY | TIME_DEPOSIT
  kind: text("kind").notNull(),
  annualRate: numeric("annual_rate", { precision: 7, scale: 4 }).notNull(),
  accrualMethod: text("accrual_method").notNull(),
  minimumBalance: numeric("minimum_balance", { precision: 14, scale: 2 }).notNull(),
  minimumOpeningDeposit: numeric("minimum_opening_deposit", { precision: 14, scale: 2 }).notNull(),
  maxWithdrawalAmount: numeric("max_withdrawal_amount", { precision: 14, scale: 2 }),
  maxWithdrawalsPerMonth: integer("max_withdrawals_per_month"),
  termMonths: integer("term_months"),
  status: text("status").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});
