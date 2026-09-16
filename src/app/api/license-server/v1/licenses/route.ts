import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { LicenseStatus, UserRole } from "@prisma/client";
import { isLicenseServerEnabled } from "@/lib/licensing/crypto";
import { ensureDefaultCatalog, issueSignedLicense } from "@/lib/license-server/issue";
import { logLicenseServerAudit } from "@/lib/license-server/audit";
import { prisma } from "@/lib/db";
import { requestMeta } from "@/lib/request-meta";
import { latestHeartbeat } from "@/lib/license-server/desk-shared";
import { forbiddenJson } from "@/lib/http";

function requireVendor(session: Awaited<ReturnType<typeof getSession>>) {
  return Boolean(session && session.role === UserRole.SUPER_ADMIN && requirePermission(session, "license.manage"));
}

export async function GET() {
  const session = await getSession();
  if (!requireVendor(session)) return forbiddenJson();

  await ensureDefaultCatalog();
  const [licences, products, plans, schools, customers] = await Promise.all([
    prisma.issuedLicense.findMany({
      include: { product: true, plan: true, customer: true, activations: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.licenseProduct.findMany({ orderBy: { name: "asc" } }),
    prisma.licensePlan.findMany({ orderBy: { name: "asc" } }),
    prisma.school.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.licenseCustomer.findMany({ orderBy: { name: "asc" } }),
  ]);

  const schoolRows = await prisma.schoolLicense.findMany({
    where: { licenseKey: { in: licences.map((row) => row.licenseKey) } },
    select: { licenseKey: true, lastVerifiedAt: true, nextVerificationAt: true, schoolId: true },
  });
  const schoolByKey = new Map(schoolRows.map((row) => [row.licenseKey, row]));

  return NextResponse.json({
    enabled: isLicenseServerEnabled(),
    customers,
    products,
    plans,
    schools,
    licences: licences.map((row) => {
      const cached = schoolByKey.get(row.licenseKey);
      const lastHeartbeatAt = latestHeartbeat([
        cached?.lastVerifiedAt,
        ...row.activations.map((item) => item.lastSeenAt),
      ]);
      return {
        ...row,
        lastHeartbeatAt,
        nextVerificationAt: cached?.nextVerificationAt ?? null,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireVendor(session)) return forbiddenJson();
  if (!isLicenseServerEnabled()) {
    return NextResponse.json({ message: "Licence signing is not enabled on this installation" }, { status: 503 });
  }
  const body = (await request.json()) as {
    productCode?: string;
    planCode?: string;
    customerId?: string | null;
    institutionId?: string;
    institutionName?: string;
    status?: LicenseStatus;
    expiresAt?: string | null;
    gracePeriodDays?: number;
    limits?: Record<string, number | null>;
    features?: Record<string, boolean>;
    domains?: string[];
  };
  const issued = await issueSignedLicense({
    productCode: body.productCode,
    planCode: body.planCode,
    customerId: body.customerId,
    institutionId: body.institutionId,
    institutionName: body.institutionName,
    status: body.status,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    gracePeriodDays: body.gracePeriodDays,
    limits: body.limits,
    features: body.features,
    domains: body.domains,
  });
  await logLicenseServerAudit({
    action: "LICENSE_ISSUED",
    licenseKey: issued.licenseKey,
    actor: session!.email,
    result: "ok",
    metadata: { customerId: body.customerId ?? null, institutionId: body.institutionId ?? null },
    ipAddress: requestMeta(request).ipAddress,
  });
  return NextResponse.json(issued, { status: 201 });
}
