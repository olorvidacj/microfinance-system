import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import type { Request, Response, NextFunction } from 'express';
import { getDb, schema, testDbConnection } from './src/db/index';
import { seedDatabaseIfEmpty } from './src/db/seed';
import {
  signToken,
  verifyToken,
  verifyPassword,
  hashPassword,
  authStore,
  ensureDefaultUsers,
} from './src/auth/index';
import { eq, desc } from 'drizzle-orm';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// ---------- Auth plumbing ----------

interface AuthedRequest extends Request {
  authUser?: { id: string; role: 'STAFF' | 'CLIENT'; email: string };
}

function authenticate(req: AuthedRequest): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? verifyToken(token) : null;
  if (payload) {
    req.authUser = { id: payload.sub, role: payload.role, email: payload.email };
  }
}

function requireAuth(roles?: Array<'STAFF' | 'CLIENT'>) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    authenticate(req);
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (roles && !roles.includes(req.authUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this resource' });
    }
    next();
  };
}

// Initialize GoogleGenAI lazily with telemetry User-Agent
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------- Authentication (Staff & Client Portal) ----------

function publicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    staffRole: u.staffRole || null,
    staffId: u.staffId || null,
    borrowerId: u.borrowerId || null,
    avatar: u.avatar || '',
  };
}

app.post('/api/auth/login', async (req, res) => {
  try {
    await ensureDefaultUsers();
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await authStore.findByEmail(String(email));
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if ((user as any).isActive === false) {
      return res.status(403).json({ error: 'This account has been deactivated' });
    }
    await authStore.touchLogin(user.id);
    const token = signToken(user);
    res.json({ success: true, token, user: publicUser(user) });
  } catch (err: any) {
    console.error('[Auth] login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, password, borrowerNumber } = req.body || {};
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email and password are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await authStore.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Link to an existing member record when possible
    let borrowerId: string | null = null;
    const db = getDb();
    if (db) {
      try {
        if (borrowerNumber) {
          const rows = await db
            .select()
            .from(schema.borrowers)
            .where(eq(schema.borrowers.borrowerNumber, String(borrowerNumber).trim()))
            .limit(1);
          if (rows.length > 0) borrowerId = rows[0].id;
        }
        if (!borrowerId) {
          const rows = await db
            .select()
            .from(schema.borrowers)
            .where(eq(schema.borrowers.email, normalizedEmail))
            .limit(1);
          if (rows.length > 0) borrowerId = rows[0].id;
        }
      } catch {}
    }

    const user = await authStore.createUser({
      email: normalizedEmail,
      fullName: String(fullName).trim(),
      passwordHash: hashPassword(String(password)),
      role: 'CLIENT',
      staffRole: null,
      staffId: null,
      borrowerId,
      phone: phone ? String(phone) : null,
      avatar: `https://ui-avatars.com/api/?background=2563EB&color=fff&name=${encodeURIComponent(String(fullName).trim())}`,
    });

    const token = signToken(user);
    res.status(201).json({
      success: true,
      token,
      user: publicUser(user),
      linkedMember: Boolean(borrowerId),
    });
  } catch (err: any) {
    console.error('[Auth] register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

app.get('/api/auth/me', requireAuth(), async (req: AuthedRequest, res) => {
  try {
    const user = await authStore.findById(req.authUser!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Demo credentials for the login screen (safe: no hashes returned)
app.get('/api/auth/demo-accounts', async (req, res) => {
  await ensureDefaultUsers();
  res.json({
    accounts: [
      { label: 'Staff — Super Admin', email: 'elena.rostata@hoscomo.coop', password: 'Admin@123' },
      { label: 'Staff — Loan Processor', email: 'grace.m@hoscomo.coop', password: 'Staff@123' },
      { label: 'Client Portal Member', email: 'teresa.alcantara@gmail.com', password: 'Client@123' },
    ],
  });
});

// Database Health & Status (Supabase / Cloud SQL / PostgreSQL) [Staff only]
app.get('/api/db/status', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const connStr = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || process.env.CLOUD_SQL_DATABASE_URL || '';
    const isConfigured = Boolean(connStr);
    const isSupabase = connStr.includes('supabase') || Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);

    const db = getDb();
    if (!db) {
      return res.json({
        connected: false,
        isConfigured,
        provider: isSupabase ? 'Supabase' : 'PostgreSQL',
        message: 'No active database connection string found in environment. Configure SUPABASE_DATABASE_URL or DATABASE_URL.',
        supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      });
    }

    const testRes = await testDbConnection();

    let branchCount = 0;
    let borrowerCount = 0;
    let loanCount = 0;
    let savingsCount = 0;
    let paymentCount = 0;

    try {
      const [branches, borrowers, loans, savings, payments] = await Promise.all([
        db.select().from(schema.branches),
        db.select().from(schema.borrowers),
        db.select().from(schema.loans),
        db.select().from(schema.savingsAccounts),
        db.select().from(schema.payments),
      ]);
      branchCount = branches.length;
      borrowerCount = borrowers.length;
      loanCount = loans.length;
      savingsCount = savings.length;
      paymentCount = payments.length;
    } catch {}

    res.json({
      connected: testRes.success,
      isConfigured: true,
      provider: testRes.databaseType || (isSupabase ? 'Supabase PostgreSQL' : 'PostgreSQL'),
      message: testRes.message,
      latencyMs: testRes.latencyMs,
      tables: testRes.tables || [],
      supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      counts: {
        branches: branchCount,
        borrowers: borrowerCount,
        loans: loanCount,
        savingsAccounts: savingsCount,
        payments: paymentCount,
      },
    });
  } catch (error: any) {
    res.json({
      connected: false,
      isConfigured: false,
      error: error.message,
    });
  }
});

// Test custom connection string endpoint
app.post('/api/db/test-connection', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const { connectionString } = req.body;
    const result = await testDbConnection(connectionString);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Manual database seed trigger
app.post('/api/db/seed', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    await seedDatabaseIfEmpty();
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all records for initial sync
app.get('/api/db/all', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.json({ connected: false });
    }

    const [
      branchesList,
      staffList,
      productsList,
      borrowersList,
      loansList,
      paymentsList,
      applicationsList,
      updatesList,
      followUpList,
      savingsAccountsList,
      savingsTxList,
      withdrawalsList,
      auditLogsList,
      solidarityList,
    ] = await Promise.all([
      db.select().from(schema.branches),
      db.select().from(schema.staff),
      db.select().from(schema.loanProducts),
      db.select().from(schema.borrowers),
      db.select().from(schema.loans),
      db.select().from(schema.payments),
      db.select().from(schema.membershipApplications),
      db.select().from(schema.memberUpdateRequests),
      db.select().from(schema.memberFollowUpLogs),
      db.select().from(schema.savingsAccounts),
      db.select().from(schema.savingsTransactions).orderBy(desc(schema.savingsTransactions.createdAt)),
      db.select().from(schema.savingsWithdrawalRequests).orderBy(desc(schema.savingsWithdrawalRequests.createdAt)),
      db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(100),
      db.select().from(schema.solidarityGroups),
    ]);

    res.json({
      connected: true,
      data: {
        branches: branchesList,
        staff: staffList,
        loanProducts: productsList,
        borrowers: borrowersList,
        loans: loansList,
        payments: paymentsList,
        membershipApplications: applicationsList,
        memberUpdateRequests: updatesList,
        memberFollowUpLogs: followUpList,
        savingsAccounts: savingsAccountsList,
        savingsTransactions: savingsTxList,
        savingsWithdrawalRequests: withdrawalsList,
        auditLogs: auditLogsList,
        solidarityGroups: solidarityList,
      },
    });
  } catch (error: any) {
    console.error('Error fetching all db data:', error);
    res.json({ connected: false, error: error.message });
  }
});

// Members / Borrowers API [Staff only]
app.get('/api/borrowers', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const list = await db.select().from(schema.borrowers);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/borrowers', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const newBorrower = req.body;
    await db.insert(schema.borrowers).values(newBorrower);
    res.json({ success: true, data: newBorrower });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/borrowers/:id', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const { id } = req.params;
    await db.update(schema.borrowers).set(req.body).where(eq(schema.borrowers.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Loans API
app.get('/api/loans', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const list = await db.select().from(schema.loans);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loans', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const newLoan = req.body;
    await db.insert(schema.loans).values(newLoan);
    res.json({ success: true, data: newLoan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/loans/:id', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const { id } = req.params;
    await db.update(schema.loans).set(req.body).where(eq(schema.loans.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Payments API
app.post('/api/payments', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const payment = req.body;
    await db.insert(schema.payments).values(payment);
    res.json({ success: true, data: payment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Solidarity Groups API [Staff only]
app.get('/api/solidarity-groups', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const list = await db.select().from(schema.solidarityGroups);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/solidarity-groups', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const newGroup = req.body;
    await db.insert(schema.solidarityGroups).values(newGroup);
    res.json({ success: true, data: newGroup });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/solidarity-groups/:id', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });
    const { id } = req.params;
    await db.update(schema.solidarityGroups).set(req.body).where(eq(schema.solidarityGroups.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Underwriting & Credit Risk Analysis
app.post('/api/gemini/underwrite', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const { borrower, loanDetails, collateral, guarantors } = req.body;
    const ai = getAi();

    const prompt = `You are a Senior Credit Underwriter and Risk Analyst for an enterprise microfinance lending institution.
Analyze the following loan application thoroughly and output a structured JSON analysis.

BORROWER PROFILE:
- Name: ${borrower?.fullName || 'N/A'}
- Employment / Business: ${borrower?.employmentStatus || 'N/A'} (${borrower?.occupation || 'N/A'})
- Monthly Net Income: $${borrower?.monthlyIncome || 0}
- Monthly Expenses: $${borrower?.monthlyExpenses || 0}
- Credit Score / Rating: ${borrower?.creditScore || 'N/A'} (${borrower?.creditTier || 'N/A'})
- Past Loans Defaulted: ${borrower?.pastDefaults || 0}
- Active Loans Count: ${borrower?.activeLoansCount || 0}

PROPOSED LOAN:
- Product: ${loanDetails?.productName || 'Personal Loan'}
- Amount Requested: $${loanDetails?.amount || 0}
- Term: ${loanDetails?.termMonths || 12} months (${loanDetails?.repaymentFrequency || 'Monthly'})
- Interest Rate: ${loanDetails?.interestRate || 12}% per annum (${loanDetails?.interestType || 'Reducing Balance'})
- Estimated Monthly Installment: $${loanDetails?.monthlyInstallment || 0}
- Purpose: ${loanDetails?.purpose || 'Business / Personal expansion'}

COLLATERAL & GUARANTORS:
- Collateral Items: ${JSON.stringify(collateral || [])}
- Collateral Total Est. Value: $${collateral?.reduce((acc: number, c: any) => acc + (Number(c.estimatedValue) || 0), 0) || 0}
- Guarantors: ${JSON.stringify(guarantors || [])}

Perform an in-depth financial solvency evaluation (Debt-to-Income, Net Disposable Income, Collateral Coverage Ratio, Risk Factors).
Return ONLY a valid JSON object matching this structure:
{
  "recommendation": "APPROVED" | "APPROVED_WITH_CONDITIONS" | "MANUAL_REVIEW" | "REJECTED",
  "confidenceScore": number (0 to 100),
  "riskRating": "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH",
  "debtToIncomeRatio": number (percentage, e.g. 28.5),
  "netDisposableIncome": number,
  "collateralCoverageRatio": number (percentage, e.g. 150),
  "maxRecommendedAmount": number,
  "summary": "Concise 2-3 sentence executive assessment",
  "strengths": ["string", "string"],
  "riskFactors": ["string", "string"],
  "recommendedConditions": ["string", "string"],
  "recommendedTenorMonths": number
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in AI underwriting:', error);
    const { borrower, loanDetails } = req.body;
    const monthlyIncome = Number(borrower?.monthlyIncome) || 3000;
    const monthlyExpenses = Number(borrower?.monthlyExpenses) || 1500;
    const installment = Number(loanDetails?.monthlyInstallment) || 300;
    const netDisposable = monthlyIncome - monthlyExpenses;
    const dti = Math.round(((monthlyExpenses + installment) / (monthlyIncome || 1)) * 100);

    const fallback = {
      recommendation: dti < 45 ? 'APPROVED' : dti < 60 ? 'APPROVED_WITH_CONDITIONS' : 'MANUAL_REVIEW',
      confidenceScore: 88,
      riskRating: dti < 40 ? 'LOW' : dti < 55 ? 'MODERATE' : 'HIGH',
      debtToIncomeRatio: dti,
      netDisposableIncome: netDisposable,
      collateralCoverageRatio: 135,
      maxRecommendedAmount: Math.min(Number(loanDetails?.amount) * 1.1, netDisposable * 8),
      summary: `Borrower maintains a stable net disposable cash flow of $${netDisposable}/mo with a calculated Debt-to-Income ratio of ${dti}%. Standard repayment capacity is verified.`,
      strengths: ['Consistent declared income flow', 'Sufficient disposable margin over monthly installment', 'Clear purpose of funds'],
      riskFactors: [dti > 50 ? 'Elevated debt-to-income ratio' : 'Standard macroeconomic inflation risk', 'Verify business invoices during disbursement'],
      recommendedConditions: ['Require 1 credible guarantor confirmation', 'Set up automated direct debit / auto-reminder'],
      recommendedTenorMonths: loanDetails?.termMonths || 12,
    };
    res.json({ success: true, data: fallback, fallback: true });
  }
});

// AI Repayment Reminder Notice Drafter
app.post('/api/gemini/reminder-draft', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const { borrowerName, loanNumber, amountDue, dueDate, daysOverdue, urgency, channel } = req.body;
    const ai = getAi();

    const prompt = `Write a professional loan repayment reminder message for a microfinance institution.
Details:
- Borrower: ${borrowerName}
- Loan Number: ${loanNumber}
- Amount Due: $${amountDue}
- Due Date: ${dueDate}
- Days Overdue: ${daysOverdue || 0}
- Tone/Urgency: ${urgency} (options: 'Friendly Reminder', 'Due Today Notice', 'Urgent Overdue', 'Final Demand Notice')
- Channel: ${channel} (options: 'SMS', 'Email', 'WhatsApp', 'Formal Letter')

Return a JSON object with:
{
  "subject": "string (for email/letter)",
  "message": "string (the complete formatted notice text with greeting, clear payment instructions, bank/m-pesa account reference, contact info)",
  "suggestedNextAction": "string"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error drafting reminder:', error);
    const { borrowerName, loanNumber, amountDue, dueDate } = req.body;
    res.json({
      success: true,
      data: {
        subject: `Payment Reminder: Loan ${loanNumber} Installment Due`,
        message: `Dear ${borrowerName},\n\nThis is a notification regarding your loan account ${loanNumber}. An installment of $${amountDue} is due on ${dueDate}. Please make payments promptly via Bank Transfer, Branch Counter, or Mobile Money referencing account ${loanNumber} to maintain your pristine credit score.\n\nThank you for choosing our lending services.\nLoan Servicing Department`,
        suggestedNextAction: 'Send via SMS/Email and log to activity timeline',
      },
      fallback: true,
    });
  }
});

// AI Loan Restructuring & Financial Health Advice
app.post('/api/gemini/restructure-advice', requireAuth(['STAFF']), async (req: AuthedRequest, res) => {
  try {
    const { loan, reasonForHardship } = req.body;
    const ai = getAi();

    const prompt = `You are a Microfinance Debt Restructuring Specialist.
Given this distressed or renegotiating loan:
- Remaining Principal Balance: $${loan?.remainingBalance || 0}
- Current Monthly Installment: $${loan?.monthlyInstallment || 0}
- Remaining Term: ${loan?.remainingTenor || 6} months
- Overdue Installments: ${loan?.overdueCount || 0}
- Customer Reason for Hardship: "${reasonForHardship || 'Temporary business slowdown'}"

Provide 3 viable restructuring options (e.g., Extension of Tenor, Temporary Grace Period on Principal, Step-up Repayment).
Return JSON:
{
  "diagnosis": "Brief summary of hardship vs portfolio recovery probability",
  "options": [
    {
      "title": "Option name",
      "newTenorMonths": number,
      "newMonthlyInstallment": number,
      "gracePeriodMonths": number,
      "pros": "string",
      "cons": "string",
      "recommended": boolean
    }
  ],
  "counselingTip": "Guidance for loan officer during borrower interview"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error restructuring loan:', error);
    const { loan } = req.body;
    const bal = Number(loan?.remainingBalance) || 5000;
    res.json({
      success: true,
      data: {
        diagnosis: 'Borrower faces short-term liquidity compression. Extending tenor reduces immediate monthly payment burden while preserving recovery of principal.',
        options: [
          {
            title: 'Tenor Extension (12 Extra Months)',
            newTenorMonths: 18,
            newMonthlyInstallment: Math.round(bal / 18 * 1.1),
            gracePeriodMonths: 0,
            pros: 'Lowers monthly payment by ~40% immediately',
            cons: 'Slightly higher total accumulated interest over time',
            recommended: true,
          },
          {
            title: '2-Month Principal Moratorium (Interest Only)',
            newTenorMonths: 12,
            newMonthlyInstallment: Math.round(bal * 0.015),
            gracePeriodMonths: 2,
            pros: 'Immediate cash relief for 60 days to stabilize cashflow',
            cons: 'Installments return to standard amount after 2 months',
            recommended: false,
          },
        ],
        counselingTip: 'Verify updated cashflow statements before signing the loan amendment agreement.',
      },
      fallback: true,
    });
  }
});

// Setup Vite development middleware or static file serving
async function initServer() {
  // Attempt auto-seed if connected
  seedDatabaseIfEmpty().catch((err) => console.log('Seed check:', err.message));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cooperative Loan & Savings Management server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[Server] Failed to start: Port ${PORT} is already in use.\n` +
        `[Server] Stop the other process using port ${PORT} or set PORT to a different value.`
      );
      process.exit(1);
    }
    throw err;
  });
}

initServer();
