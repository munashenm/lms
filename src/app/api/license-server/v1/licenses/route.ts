import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { isLicenseServerEnabled } from "@/lib/licensing/crypto";
import { ensureDefaultCatalog, issueSignedLicense } from "@/lib/license-server/issue";
import { logLicenseServerAudit } from "@/lib/license-server/audit";
import { prisma } from "@/lib/db";
import { requestMeta } from "@/lib/request-meta";
import { LicenseStatus } from "@prisma/client";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== UserRole.SUPER_ADMIN || !requirePermission(session, "license.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  await ensureDefaultCatalog();
  const [licences, products, plans, schools] = await Promise.all([
    prisma.issuedLicense.findMany({
      include: { product: true, plan: true, customer: true, activations: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.licenseProduct.findMany({ orderBy: { name: "asc" } }),
    prisma.licensePlan.findMany({ orderBy: { name: "asc" } }),
    prisma.school.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return NextResponse.json({
    enabled: isLicenseServerEnabled(),
    licences,
    products,
    plans,
    schools,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  if (!isLicenseServerEnabled()) {
    return NextResponse.json({ message: "Licence signing is not enabled on this installation" }, { status: 503 });
  }
  const body = (await request.json()) as {
    productCode?: string;
    planCode?: string;
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
    actor: session.email,
    result: "ok",
    ipAddress: requestMeta(request).ipAddress,
  });
  return NextResponse.json(issued, { status: 201 });
}
