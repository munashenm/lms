import { NextRequest, NextResponse } from "next/server";
import { isLicenseServerEnabled } from "@/lib/licensing/crypto";
import { checkIssuedLicense } from "@/lib/license-server/issue";
import { logLicenseServerAudit } from "@/lib/license-server/audit";
import { requestMeta } from "@/lib/request-meta";

export async function POST(request: NextRequest) {
  if (!isLicenseServerEnabled() && process.env.LICENSE_SERVER_ENABLED !== "true") {
    return NextResponse.json({ message: "Licence server is not enabled on this installation" }, { status: 404 });
  }
  if (!isLicenseServerEnabled()) {
    return NextResponse.json({ message: "LICENSE_SIGNING_PRIVATE_KEY is not configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    licenseKey?: string;
    product?: string;
    institutionId?: string;
    installationId?: string;
    domain?: string;
    serverInstanceId?: string;
  };
  const meta = requestMeta(request);
  try {
    if (!body.licenseKey) {
      return NextResponse.json({ message: "licenseKey required" }, { status: 400 });
    }
    const result = await checkIssuedLicense({
      licenseKey: body.licenseKey,
      product: body.product,
      institutionId: body.institutionId,
      installationId: body.installationId,
      domain: body.domain,
      serverInstanceId: body.serverInstanceId,
    });
    await logLicenseServerAudit({
      action: "LICENSE_CHECKED",
      licenseKey: body.licenseKey,
      result: "ok",
      metadata: { product: body.product, installationId: body.installationId },
      ipAddress: meta.ipAddress,
    });
    return NextResponse.json({ token: result.token, claims: result.claims });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 400;
    await logLicenseServerAudit({
      action: "LICENSE_CHECKED",
      licenseKey: body.licenseKey,
      result: "error",
      metadata: { message: error instanceof Error ? error.message : "failed" },
      ipAddress: meta.ipAddress,
    });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Check failed" }, { status });
  }
}
