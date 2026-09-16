import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { isLicenseServerEnabled } from "@/lib/licensing/crypto";
import { applyVendorLicenseAction } from "@/lib/license-server/desk";
import { isVendorLicenseAction } from "@/lib/license-server/desk-shared";
import { logLicenseServerAudit } from "@/lib/license-server/audit";
import { vendorLicenseActionSchema } from "@/lib/validators";
import { requestMeta } from "@/lib/request-meta";
import { forbiddenJson } from "@/lib/http";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== UserRole.SUPER_ADMIN || !requirePermission(session, "license.manage")) {
    return forbiddenJson();
  }
  if (!isLicenseServerEnabled()) {
    return NextResponse.json({ message: "Licence signing is not enabled on this installation" }, { status: 503 });
  }

  const { id } = await params;
  const parsed = vendorLicenseActionSchema.safeParse(await request.json());
  if (!parsed.success || !isVendorLicenseAction(parsed.data.action)) {
    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  }

  try {
    const result = await applyVendorLicenseAction({
      licenseId: id,
      action: parsed.data.action,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    await logLicenseServerAudit({
      action: `LICENSE_${parsed.data.action.toUpperCase()}`,
      licenseKey: result.licenseKey,
      actor: session.email,
      result: "ok",
      metadata: { status: result.status, expiresAt: result.expiresAt?.toISOString() ?? null },
      ipAddress: requestMeta(request).ipAddress,
    });
    return NextResponse.json({
      ok: true,
      licenseKey: result.licenseKey,
      status: result.status,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 400;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not update licence" },
      { status }
    );
  }
}
