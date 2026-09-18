import { getDb, schema } from './index';
import { initDbSchema } from './initDb';
import {
  INITIAL_BRANCHES,
  INITIAL_STAFF,
  INITIAL_LOAN_PRODUCTS,
} from '../data/initialData';

/**
 * Seeds cooperative CONFIGURATION/REFERENCE data only (branches, staff, loan
 * products, KYC document requirements). No member, loan, savings, or financial
 * records are ever fabricated — those come exclusively from real transactions.
 */
export async function seedDatabaseIfEmpty() {
  const db = getDb();
  if (!db) {
    console.warn('[Database] Connection unavailable. Skipping seed.');
    return;
  }

  try {
    await initDbSchema();

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

    if (INITIAL_LOAN_PRODUCTS.length > 0) {
      await db.insert(schema.loanProducts).values(INITIAL_LOAN_PRODUCTS as any);
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