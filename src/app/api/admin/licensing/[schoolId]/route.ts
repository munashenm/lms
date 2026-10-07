import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { schoolLicenseAdminActionSchema } from "@/lib/validators";
import { applySchoolLicenseAdminAction } from "@/lib/licensing/admin-actions";
import { countLicenseUsage } from "@/lib/licensing/usage";
import { evaluateStoredLicense } from "@/lib/licensing/service";
import { prisma } from "@/lib/db";
import { estimatedMonthlySubscription, formatZar } from "@/lib/licensing/commercial";
import { normalizeFeatures } from "@/lib/licensing/features";
import { logLicenseServerAudit } from "@/lib/license-server/audit";
import { requestMeta } from "@/lib/request-meta";

interface Params {
  params: Promise<{ schoolId: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (session?.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { schoolId } = await params;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: { license: { include: { features: true, checks: { orderBy: { checkedAt: "desc" }, take: 20 } } } },
  });
  if (!school) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const [usage, evaluation] = await Promise.all([
    countLicenseUsage(schoolId),
    evaluateStoredLicense(schoolId),
  ]);
  const rate = school.license?.pricePerLearner ?? null;
  const estimated = estimatedMonthlySubscription(usage.activeLearners, rate);

  return NextResponse.json({
    school: {
      id: school.id,
      name: school.name,
      slug: school.slug,
      institutionType: school.institutionType,
      isActive: school.isActive,
    },
    license: school.license
      ? {
          ...school.license,
          pricePerLearner: school.license.pricePerLearner?.toString() ?? null,
          storageLimitBytes: school.license.storageLimitBytes?.toString() ?? null,
          features: normalizeFeatures(school.license.featuresJson as Record<string, boolean>),
        }
      : null,
    usage,
    evaluation,
    estimatedMonthly: formatZar(estimated),
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (session?.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { schoolId } = await params;
  const parsed = schoolLicenseAdminActionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid action", errors: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await applySchoolLicenseAdminAction({
      schoolId,
      action: parsed.data.action,
      actorEmail: session.email,
      actorUserId: session.userId,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      planCode: parsed.data.planCode,
      features: parsed.data.features,
      pricePerLearner: parsed.data.pricePerLearner,
      priceCurrency: parsed.data.priceCurrency,
      priceNotes: parsed.data.priceNotes,
      reason: parsed.data.reason,
    });

    await logLicenseServerAudit({
      action: `SCHOOL_${parsed.data.action.toUpperCase()}`,
      licenseKey: result.license.licenseKey,
      actor: session.email,
      result: "ok",
      metadata: {
        schoolId,
        status: result.license.status,
        expiresAt: result.license.expiresAt?.toISOString() ?? null,
        pricePerLearner: result.license.pricePerLearner?.toString() ?? null,
      },
      ipAddress: requestMeta(request).ipAddress,
    });

    return NextResponse.json({
      ok: true,
      license: {
        id: result.license.id,
        status: result.license.status,
        expiresAt: result.license.expiresAt,
        planCode: result.license.planCode,
        pricePerLearner: result.license.pricePerLearner?.toString() ?? null,
      },
      evaluation: result.evaluation,
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 400;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not update licence" },
      { status }
    );
  }
}
