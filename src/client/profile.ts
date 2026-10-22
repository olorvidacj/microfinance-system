import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { HttpError, type AppDb } from '../kyc/errors';
import { PROFILE_LOCKED_MESSAGE, phoneKey, validateProfileUpdate } from '../../shared/kyc-core';
import { centsFromDb, centsToDecimal } from '../../shared/lending';
import type { ClientProfileView } from '../../shared/client';
import type { LendingClient } from '../lending/service';

/** The member's own profile, read from their borrower record only. */
export async function ownProfile(db: AppDb, client: LendingClient): Promise<ClientProfileView> {
  const [b] = await db.select().from(schema.borrowers).where(eq(schema.borrowers.id, client.borrowerId)).limit(1);
  if (!b) throw new HttpError(404, 'Your member record was not found. Please contact your branch.', 'MEMBER_NOT_FOUND');
  const [u] = await db.select({ avatar: schema.users.avatar }).from(schema.users).where(eq(schema.users.id, client.userId)).limit(1);
  // Only a photo the member actually uploaded; never a generated third-party URL.
  const uploaded = (v: string | null | undefined) => (v && !v.includes('ui-avatars.com') ? v : null);
  return {
    id: b.id,
    fullName: b.fullName,
    firstName: b.firstName ?? '',
    middleName: b.middleName ?? '',
    lastName: b.lastName ?? '',
    suffix: b.suffix ?? '',
    email: b.email,
    phone: b.phone,
    address: b.address,
    barangay: b.barangay ?? '',
    cityMunicipality: b.cityMunicipality ?? '',
    province: b.province ?? '',
    postalCode: b.postalCode ?? '',
    gender: b.gender,
    dateOfBirth: b.dateOfBirth,
    civilStatus: b.civilStatus,
    employmentStatus: b.employmentStatus,
    occupation: b.occupation,
    employer: b.employerOrBusiness,
    monthlyIncome: centsToDecimal(centsFromDb(b.monthlyIncome ?? 0)),
    avatar: uploaded(u?.avatar) ?? uploaded(b.avatar),
    memberNumber: b.borrowerNumber,
    membershipDate: b.membershipDate,
    kycStatus: b.kycStatus,
    creditScore: b.creditScore,
    creditTier: b.creditTier,
  };
}

/**
 * The member edits their own contact and work details (shared/kyc-core/profile.ts).
 * Identity fields are refused, not silently ignored, so the screen can say why.
 */
export async function updateOwnProfile(db: AppDb, client: LendingClient, dto: Record<string, unknown>) {
  const v = validateProfileUpdate(dto);
  if (v.locked.length) throw new HttpError(409, PROFILE_LOCKED_MESSAGE, 'PROFILE_LOCKED', { fields: Object.fromEntries(v.locked.map((f) => [f, 'Changed through KYC or your branch.'])) });
  if (!v.ok) throw new HttpError(400, 'Check the highlighted fields.', 'INVALID_PROFILE', { fields: v.errors });
  const u = v.value;
  if (!Object.keys(u).length) throw new HttpError(400, 'Nothing to update.', 'NOTHING_TO_UPDATE');

  await db.transaction(async (tx) => {
    if (u.phone) {
      // The phone number is also a sign-in identifier, so it must stay unique.
      const key = phoneKey(u.phone);
      const others = await tx.select({ id: schema.users.id, phone: schema.users.phone }).from(schema.users);
      if (others.some((o) => o.id !== client.userId && o.phone && phoneKey(o.phone) === key)) {
        throw new HttpError(409, 'This mobile number is already used by another account.', 'PHONE_TAKEN', { fields: { phone: 'Already used by another account.' } });
      }
      await tx.update(schema.users).set({ phone: u.phone }).where(eq(schema.users.id, client.userId));
    }
    await tx
      .update(schema.borrowers)
      .set({
        ...(u.phone !== undefined ? { phone: u.phone } : {}),
        ...(u.address !== undefined ? { address: u.address } : {}),
        ...(u.barangay !== undefined ? { barangay: u.barangay } : {}),
        ...(u.cityMunicipality !== undefined ? { cityMunicipality: u.cityMunicipality } : {}),
        ...(u.province !== undefined ? { province: u.province } : {}),
        ...(u.civilStatus !== undefined ? { civilStatus: u.civilStatus } : {}),
        ...(u.occupation !== undefined ? { occupation: u.occupation } : {}),
        ...(u.employer !== undefined ? { employerOrBusiness: u.employer } : {}),
        ...(u.monthlyIncome !== undefined ? { monthlyIncome: Number(u.monthlyIncome) } : {}),
      })
      .where(eq(schema.borrowers.id, client.borrowerId));
    const [b] = await tx.select({ branchId: schema.borrowers.branchId }).from(schema.borrowers).where(eq(schema.borrowers.id, client.borrowerId)).limit(1);
    await tx.insert(schema.auditLogs).values({
      id: `aud-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      action: 'PROFILE_UPDATED',
      details: `${client.name} updated ${Object.keys(u).join(', ')} in the portal.`,
      performedBy: client.userId,
      branchId: b?.branchId ?? 'all',
      type: 'MEMBERSHIP',
      userName: client.name,
      userRole: 'CLIENT',
      targetType: 'Borrower',
      targetId: client.borrowerId,
    });
  });
}
