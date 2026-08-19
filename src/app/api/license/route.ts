import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/request-meta";
import { resolveLicenseSchoolId } from "@/lib/licensing/enforce";
import { countLicenseUsage, ensureInstallationId } from "@/lib/licensing/usage";
import {
  applySignedClaims,
  checkLicenseWithServer,
  createLocalTrialLicense,
  evaluateStoredLicense,
  licenseServerUrl,
} from "@/lib/licensing/service";
import { getLicensePublicKey, verifyLicenseToken } from "@/lib/licensing/crypto";
import { LICENSE_FEATURE_LABELS } from "@/lib/licensing/features";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "license.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await resolveLicenseSchoolId(
    session!,
    request.nextUrl.searchParams.get("schoolId")
  );
  if (!schoolId) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }
  if (!canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) return NextResponse.json({ message: "School not found" }, { status: 404 });

  let license = await prisma.schoolLicense.findUnique({
    where: { schoolId },
    include: { features: true },
  });
  if (!license) {
    await createLocalTrialLicense(schoolId);
    license = await prisma.schoolLicense.findUnique({
      where: { schoolId },
      include: { features: true },
    });
  }

  const evaluation = await evaluateStoredLicense(schoolId);
  const usage = await countLicenseUsage(schoolId);
  const installationId = await ensureInstallationId(schoolId);

  return NextResponse.json({
    institution: { id: school.id, name: school.name, slug: school.slug },
    license: license
      ? {
          licenseKey: license.licenseKey,
          product: license.productName,
          productCode: license.productCode,
          plan: license.planName,
          planCode: license.planCode,
          status: evaluation.effectiveStatus,
          storedStatus: license.status,
          issueDate: license.issuedAt,
          startDate: license.startsAt,
          expiryDate: license.expiresAt,
          gracePeriodDays: license.gracePeriodDays,
          lastVerifiedAt: license.lastVerifiedAt,
          nextVerificationAt: license.nextVerificationAt,
          installationId,
          registeredDomain: license.registeredDomain ?? process.env.NEXT_PUBLIC_APP_URL ?? null,
          customerName: license.customerName,
          limits: {
            learners: { used: usage.activeLearners, max: license.maxLearners },
            staff: { used: usage.educators, max: license.maxEducators },
            administrators: { used: usage.administrators, max: license.maxAdministrators },
            campuses: { used: usage.campuses, max: license.maxCampuses },
            storage: { used: usage.storageBytes, max: license.storageLimitBytes?.toString() ?? null },
          },
          features: license.features.map((f) => ({
            key: f.featureKey,
            label: LICENSE_FEATURE_LABELS[f.featureKey as keyof typeof LICENSE_FEATURE_LABELS] ?? f.featureKey,
            enabled: f.enabled,
          })),
        }
      : null,
    evaluation,
    serverConfigured: Boolean(licenseServerUrl() && getLicensePublicKey()),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "license.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const body = (await request.json()) as { licenseKey?: string; schoolId?: string; token?: string };
  const schoolId = await resolveLicenseSchoolId(session!, body.schoolId);
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const meta = requestMeta(request);
  const publicKey = getLicensePublicKey();
  const installationId = await ensureInstallationId(schoolId);

  if (body.token && publicKey) {
    const verified = await verifyLicenseToken(body.token, publicKey);
    if (!verified.ok) {
      return NextResponse.json({ message: "Licence token signature is invalid" }, { status: 400 });
    }
    const row = await applySignedClaims(schoolId, verified.claims, verified.token);
    await logAudit({
      schoolId,
      userId: session!.userId,
      action: "LICENSE_ACTIVATED",
      entity: "License",
      entityId: row.id,
      ...meta,
    });
    return NextResponse.json({ ok: true, evaluation: await evaluateStoredLicense(schoolId) });
  }

  if (!body.licenseKey) {
    return NextResponse.json({ message: "Licence key is required" }, { status: 400 });
  }

  await prisma.schoolLicense.upsert({
    where: { schoolId },
    create: {
      schoolId,
      licenseKey: body.licenseKey.trim(),
      productCode: "lms",
      installationId,
      status: "TRIAL",
    },
    update: { licenseKey: body.licenseKey.trim(), installationId },
  });

  const url = licenseServerUrl();
  if (url && publicKey) {
    const evaluation = await checkLicenseWithServer(schoolId, "activate");
    await logAudit({
      schoolId,
      userId: session!.userId,
      action: "LICENSE_ACTIVATED",
      entity: "License",
      metadata: { result: evaluation.effectiveStatus },
      ...meta,
    });
    return NextResponse.json({ ok: true, evaluation });
  }

  if (session!.role !== UserRole.SUPER_ADMIN && !publicKey) {
    return NextResponse.json(
      { message: "This installation cannot verify licences. Configure LICENSE_PUBLIC_KEY and LICENSE_SERVER_URL." },
      { status: 400 }
    );
  }

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "LICENSE_ACTIVATED",
    entity: "License",
    metadata: { local: true },
    ...meta,
  });
  return NextResponse.json({ ok: true, evaluation: await evaluateStoredLicense(schoolId) });
}
