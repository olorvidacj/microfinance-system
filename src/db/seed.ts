import { getDb, markConnectionStringFailed, schema } from './index';
import { hashPassword } from '../auth/index';
import {
  INITIAL_BRANCHES,
  INITIAL_STAFF,
  INITIAL_LOAN_PRODUCTS,
} from '../data/initialData';
import { validateProduct, type ProductDto } from '../../shared/lending';
import { products as productTable } from '../lending/tables';
import { productRowValues } from '../lending/service';
import type { LoanProduct as SeedProduct } from '../types';

/** The configured products in the shape 0025 enforces (method, frequency and fee codes). */
export function seedProductDto(p: SeedProduct): ProductDto {
  const freq = String(p.defaultRepaymentFrequency || p.repaymentFrequency || 'Monthly').toUpperCase().replace(/[s-]+/g, '_');
  const fee = Number(p.processingFeePercentage) || 0;
  return {
    code: p.code,
    name: p.name,
    category: p.category,
    description: p.description || '',
    interestMethod: String(p.interestType).toUpperCase().startsWith('FLAT') ? 'FLAT' : 'DIMINISHING',
    annualRate: String(p.interestRate),
    minAmount: String(p.minAmount),
    maxAmount: String(p.maxAmount),
    minTermMonths: p.minTermMonths,
    maxTermMonths: p.maxTermMonths,
    frequency: freq === 'WEEKLY' ? 'WEEKLY' : freq === 'MONTHLY' ? 'MONTHLY' : 'BI_WEEKLY',
    fees: fee > 0 ? [{ code: 'PROCESSING', label: 'Processing fee', kind: 'PERCENT', value: String(fee) }] : [],
    penaltyRate: String(p.latePenaltyRate ?? 0),
    lendingType: 'INDIVIDUAL',
    requiresCollateral: !!p.requiresCollateral,
    requiresGuarantor: !!p.requiresGuarantor,
    status: 'ACTIVE',
  };
}

/**
 * Seeds a database built by `npm run db:migrate` (run by `npm run db:seed` and
 * at server start): the bootstrap administrator, then cooperative
 * CONFIGURATION/REFERENCE data (branches, staff, loan products, KYC document
 * requirements). Each part runs only on an empty table. No member, loan,
 * savings, or financial records are ever fabricated — those come exclusively
 * from real transactions. Creates no tables.
 */
export async function seedDatabase(): Promise<void> {
  const db = getDb();
  if (!db) {
    console.warn('[Database] Connection unavailable. Skipping seed.');
    return;
  }
  await seedBootstrapAdmin();

  try {
    const existingBranches = await db.select().from(schema.branches).limit(1);
    if (existingBranches.length > 0) {
      return;
    }

    console.log('[Database] Seeding cooperative configuration records...');

    if (INITIAL_BRANCHES.length > 0) {
      await db.insert(schema.branches).values(INITIAL_BRANCHES as any);
    }

    if (INITIAL_STAFF.length > 0) {
      await db.insert(schema.staff).values(INITIAL_STAFF as any);
    }

    for (const p of INITIAL_LOAN_PRODUCTS) {
      const v = validateProduct(seedProductDto(p));
      if (!v.ok || !v.value) throw new Error(`Seed product ${p.code} is invalid: ${JSON.stringify(v.errors)}`);
      await db.insert(productTable).values({ id: p.id, ...productRowValues(v.value) });
    }

    const initialKycRequiredDocuments = [
      { id: 'REQ-VALID_ID', documentType: 'VALID_ID', documentName: 'Primary Government ID (UMID / Driver License / Passport)', description: 'A valid, current government-issued photo ID.', isActive: true, sortOrder: 1, createdAt: new Date().toISOString() },
      { id: 'REQ-PROOF_OF_ADDRESS', documentType: 'PROOF_OF_ADDRESS', documentName: 'Barangay Clearance or Utility Bill', description: 'Recent proof of residence within the last 3 months.', isActive: true, sortOrder: 2, createdAt: new Date().toISOString() },
      { id: 'REQ-PROOF_OF_INCOME', documentType: 'PROOF_OF_INCOME', documentName: 'Payslip / Business Permit / Bank Statement', description: 'Evidence of regular income or business operations.', isActive: true, sortOrder: 3, createdAt: new Date().toISOString() },
      { id: 'REQ-PHOTO_2X2', documentType: 'PHOTO_2X2', documentName: 'Recent 2x2 ID Photo', description: 'A recent photograph with white background.', isActive: true, sortOrder: 4, createdAt: new Date().toISOString() },
    ];
    await db.insert(schema.kycRequiredDocuments).values(initialKycRequiredDocuments as any);

    console.log('[Database] Cooperative configuration seeded (branches, staff, products, KYC requirements).');
  } catch (error) {
    console.error('[Database] Error seeding database:', error);
  }
}

/**
 * The one administrator that exists before anyone can sign in. Its password
 * comes from HOSCOMCO_BOOTSTRAP_PASSWORD (default Admin@123 for local use; set
 * it for any shared environment). HOSCOMCO_SKIP_BOOTSTRAP=1 turns this off.
 */
export async function seedBootstrapAdmin(): Promise<void> {
  if (process.env.HOSCOMCO_SKIP_BOOTSTRAP === '1') return;
  const db = getDb();
  if (!db) return;
  try {
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
    if (existing) return;
    await db.insert(schema.users).values({
      id: 'u-bootstrap-admin',
      email: (process.env.HOSCOMCO_BOOTSTRAP_EMAIL || 'admin@HOSCOMCO.coop').toLowerCase(),
      passwordHash: hashPassword(process.env.HOSCOMCO_BOOTSTRAP_PASSWORD || 'Admin@123'),
      fullName: 'System Administrator',
      role: 'STAFF',
      staffRole: 'ADMINISTRATOR',
      staffId: 'staff-08',
      isActive: true,
    });
    console.log('[Database] Bootstrap administrator created.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ENOTFOUND') || msg.includes('tenant') || msg.includes('ECONNREFUSED')) markConnectionStringFailed();
    console.error('[Database] Could not create the bootstrap administrator:', msg);
  }
}
