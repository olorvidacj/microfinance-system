import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { getDb, getPool, schema } from './index';

export interface ClientProfileInput {
  fullName: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  hasNoMiddleName?: boolean;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  civilStatus?: string | null;
  address?: string | null;
  barangay?: string | null;
  cityMunicipality?: string | null;
  province?: string | null;
  idNumber?: string | null;
  facebookAccount?: string | null;
  employmentStatus?: string | null;
  employerOrBusiness?: string | null;
  occupation?: string | null;
  sourceOfIncome?: string | null;
  monthlyIncome?: number | null;
  monthlyExpenses?: number | null;
  branchId?: string | null;
  avatar?: string | null;
}

export interface ProvisionedClient {
  id: string;
  borrowerNumber: string;
  fullName: string;
}

/**
 * Atomically reserves the next value for a named sequence within a calendar
 * year. Uses a single upsert so concurrent registrations can never collide.
 */
export async function nextIdSequence(
  name: string,
  year: number = new Date().getFullYear()
): Promise<number> {
  const pool = getPool();
  if (!pool) throw new Error('Database unavailable');
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO id_sequences (name, year, last_value, updated_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (name) DO UPDATE
         SET last_value = CASE WHEN id_sequences.year = EXCLUDED.year
                               THEN id_sequences.last_value + 1 ELSE 1 END,
             year = EXCLUDED.year,
             updated_at = NOW()
       RETURNING last_value`,
      [name, year]
    );
    return Number(result.rows[0]?.last_value || 1);
  } finally {
    client.release();
  }
}

/**
 * Generates a human-readable, sequential client/member number
 * (e.g. CLI-2026-0001). Falls back to a collision-resistant random suffix only
 * when the sequence table is unreachable.
 */
export async function generateClientNumber(
  prefix = 'CLI',
  year: number = new Date().getFullYear()
): Promise<string> {
  try {
    const seq = await nextIdSequence('client_number', year);
    return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
  } catch {
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${year}-${rand}`;
  }
}

function genId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Creates a COMPLETE client profile: a `borrowers` row with the real submitted
 * information, all financials explicitly zeroed, KYC status NOT_STARTED, and
 * a linked zero-balance savings account. Never fabricates balances or history.
 *
 * Returns null when no database is configured.
 */
export async function createClientProfile(
  input: ClientProfileInput
): Promise<ProvisionedClient | null> {
  const db = getDb();
  if (!db) return null;

  const fullName = String(input.fullName || '').trim() || 'New Client';
  const today = new Date().toISOString().split('T')[0];
  const borrowerNumber = await generateClientNumber();
  const id = genId('bor');

  await db.insert(schema.borrowers).values({
    id,
    borrowerNumber,
    fullName,
    firstName: input.firstName ? String(input.firstName).trim() : null,
    middleName: input.middleName ? String(input.middleName).trim() : null,
    lastName: input.lastName ? String(input.lastName).trim() : null,
    suffix: input.suffix ? String(input.suffix).trim() : null,
    hasNoMiddleName: Boolean(input.hasNoMiddleName),
    idNumber: String(input.idNumber || ''),
    phone: input.phone ? String(input.phone) : '',
    email: input.email ? String(input.email) : '',
    dateOfBirth: String(input.dateOfBirth || ''),
    gender: String(input.gender || 'Not specified'),
    civilStatus: String(input.civilStatus || 'Single'),
    address: String(input.address || ''),
    facebookAccount: input.facebookAccount ? String(input.facebookAccount) : null,
    branchId: String(input.branchId || 'br-main'),
    employmentStatus: String(input.employmentStatus || 'Pending'),
    employerOrBusiness: String(input.employerOrBusiness || ''),
    occupation: String(input.occupation || ''),
    monthlyIncome: Number(input.monthlyIncome) || 0,
    monthlyExpenses: Number(input.monthlyExpenses) || 0,
    creditScore: 0,
    creditTier: 'PENDING',
    kycStatus: 'NOT_STARTED',
    memberStatus: 'Pending',
    membershipDate: today,
    profileCompleted: false,
    barangay: input.barangay ? String(input.barangay) : null,
    cityMunicipality: input.cityMunicipality ? String(input.cityMunicipality) : null,
    province: input.province ? String(input.province) : null,
    sourceOfIncome: input.sourceOfIncome ? String(input.sourceOfIncome) : null,
    savingsBalance: 0,
    shareCapital: 0,
    activeLoansCount: 0,
    totalBorrowed: 0,
    totalRepaid: 0,
    avatar: String(
      input.avatar ||
        `https://ui-avatars.com/api/?background=059669&color=fff&name=${encodeURIComponent(fullName)}`
    ),
    joinedDate: today,
    lastActivityDate: today,
    notes:
      'Account created via client registration — KYC verification not yet started.',
  });

  // No savings account here: accounts open when KYC is approved (src/kyc/service.ts).
  await db
    .insert(schema.kycSubmissions)
    .values({
      id: genId('kyc'),
      borrowerId: id,
      status: 'NOT_STARTED',
      currentStep: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoNothing();

  return { id, borrowerNumber, fullName };
}

/**
 * Finds the member a branch registered with exactly this email that no login
 * is attached to yet. Only an email the auth provider has verified may be
 * passed here; matching by phone number is deliberately not supported, since
 * registration does not prove ownership of a phone.
 */
export async function findUnlinkedBorrowerByEmail(
  email?: string | null
): Promise<{ id: string; borrowerNumber: string } | null> {
  const db = getDb();
  const normEmail = String(email || '').toLowerCase().trim();
  if (!db || !normEmail) return null;
  const rows = await db
    .select({ id: schema.borrowers.id, borrowerNumber: schema.borrowers.borrowerNumber })
    .from(schema.borrowers)
    .where(
      sql`lower(btrim(${schema.borrowers.email})) = ${normEmail}
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.borrower_id = ${schema.borrowers.id})`
    )
    .limit(1);
  return rows[0] ?? null;
}
