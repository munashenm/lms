import { InstitutionType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { findOrCreatePortalUser } from "@/lib/portal-provision";
import { createLocalTrialLicense } from "@/lib/licensing/service";
import { toMoneyDecimal, DEFAULT_PRICE_CURRENCY } from "@/lib/licensing/commercial";
import { asInputJson } from "@/lib/json";
import { ensureDefaultSchedules } from "@/lib/backup/schedule";

export async function createInstitutionWithTrial(params: {
  name: string;
  slug: string;
  institutionType: InstitutionType;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone?: string | null;
  trialExpiresAt?: Date | null;
  pricePerLearner?: string | number | null;
  maxLearners?: number | null;
  actorUserId: string;
  actorEmail?: string | null;
}) {
  const existingSlug = await prisma.school.findUnique({ where: { slug: params.slug } });
  if (existingSlug) {
    throw Object.assign(new Error("An institution with this slug already exists"), { status: 409 });
  }

  const school = await prisma.school.create({
    data: {
      name: params.name.trim(),
      slug: params.slug.trim().toLowerCase(),
      institutionType: params.institutionType,
      email: params.adminEmail.trim().toLowerCase(),
      phone: params.adminPhone?.trim() || null,
      isActive: true,
    },
  });

  const admin = await findOrCreatePortalUser({
    schoolId: school.id,
    email: params.adminEmail,
    firstName: params.adminFirstName,
    lastName: params.adminLastName,
    phone: params.adminPhone ?? null,
    role: UserRole.SCHOOL_ADMIN,
    actorId: params.actorUserId,
    source: "super-admin-institution-create",
  });

  if ("skipped" in admin) {
    // Roll back school if admin email conflicts with another tenant/role
    await prisma.school.delete({ where: { id: school.id } });
    throw Object.assign(
      new Error("That admin email is already in use for a different role or school"),
      { status: 409 }
    );
  }

  await ensureDefaultSchedules(school.id);

  let license = await createLocalTrialLicense(school.id);
  const rate = toMoneyDecimal(params.pricePerLearner);
  const data: {
    expiresAt?: Date;
    maxLearners?: number | null;
    pricePerLearner?: ReturnType<typeof toMoneyDecimal>;
    priceCurrency?: string;
  } = {};
  if (params.trialExpiresAt) data.expiresAt = params.trialExpiresAt;
  if (params.maxLearners != null) data.maxLearners = params.maxLearners;
  if (rate) {
    data.pricePerLearner = rate;
    data.priceCurrency = DEFAULT_PRICE_CURRENCY;
  }
  if (Object.keys(data).length > 0) {
    license = await prisma.schoolLicense.update({
      where: { id: license.id },
      data,
    });
  }

  await logAudit({
    schoolId: school.id,
    userId: params.actorUserId,
    action: "INSTITUTION_CREATED",
    entity: "School",
    entityId: school.id,
    metadata: asInputJson({
      actor: params.actorEmail ?? null,
      adminUserId: admin.userId,
      adminEmail: params.adminEmail,
      trialExpiresAt: license.expiresAt?.toISOString() ?? null,
      pricePerLearner: license.pricePerLearner?.toString() ?? null,
    }),
  });

  return {
    school,
    adminUserId: admin.userId,
    adminCreated: admin.created,
    invitesSent: admin.emailSent ? 1 : 0,
    license,
  };
}
