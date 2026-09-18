import crypto from 'crypto';
import { getDb, getPool, schema } from './index';

export interface ClientProfileInput {
  fullName: string;
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
 * information, all financials explicitly zeroed, KYC/member status Pending, and
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
    kycStatus: 'PENDING',
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
      'Account created via client registration — profile pending KYC verification.',
  });

  await db.insert(schema.savingsAccounts).values({
    id: genId('sav'),
    memberId: id,
    memberName: fullName,
    passbookNumber: `PB-${borrowerNumber}`,
    balance: 0,
    maintainingBalance: 1000,
    interestRate: 1.0,
  });

  return { id, borrowerNumber, fullName };
}

/**
 * Finds an existing borrower that shares the given phone/email so newly
 * registered auth accounts link to staff pre-registered members instead of
 * creating duplicates.
 */
export async function findBorrowerByContact(
  phone?: string | null,
  email?: string | null
): Promise<{ id: string; borrowerNumber: string } | null> {
  const db = getDb();
  if (!db) return null;
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const normEmail = String(email || '').toLowerCase().trim();
  try {
    const rows = await db.select().from(schema.borrowers);
    const match = rows.find((b) => {
      if (cleanPhone && String(b.phone).replace(/\D/g, '').endsWith(cleanPhone.slice(-10))) {
        return true;
      }
      return Boolean(b.email) && String(b.email).toLowerCase() === normEmail;
    });
    return match ? { id: match.id, borrowerNumber: match.borrowerNumber } : null;
  } catch {
    return null;
  }
}
