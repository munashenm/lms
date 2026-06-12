import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { integrationSettingsSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import {
  getPublicIntegrationSettings,
  resolveSettingsSchoolId,
  saveIntegrationSettings,
} from "@/lib/school-integrations";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schoolId = resolveSettingsSchoolId(
    session!,
    request.nextUrl.searchParams.get("schoolId")
  );

  if (!schoolId) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true },
  });

  if (!school) {
    return NextResponse.json({ message: "School not found" }, { status: 404 });
  }

  const integrations = await getPublicIntegrationSettings(schoolId);
  return NextResponse.json({ school, integrations });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = integrationSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  }

  const schoolId = resolveSettingsSchoolId(
    session!,
    parsed.data.schoolId ?? request.nextUrl.searchParams.get("schoolId")
  );

  if (!schoolId) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }

  const { schoolId: _ignored, ...settings } = parsed.data;

  await saveIntegrationSettings(schoolId, {
    sendgrid: settings.sendgrid
      ? {
          ...settings.sendgrid,
          apiKey:
            settings.sendgrid.apiKey === "" ? undefined : settings.sendgrid.apiKey,
        }
      : undefined,
    twilio: settings.twilio
      ? {
          ...settings.twilio,
          accountSid:
            settings.twilio.accountSid === "" ? undefined : settings.twilio.accountSid,
          authToken:
            settings.twilio.authToken === "" ? undefined : settings.twilio.authToken,
        }
      : undefined,
    payfast: settings.payfast
      ? {
          ...settings.payfast,
          merchantKey:
            settings.payfast.merchantKey === "" ? undefined : settings.payfast.merchantKey,
          passphrase:
            settings.payfast.passphrase === "" ? undefined : settings.payfast.passphrase,
        }
      : undefined,
    ozow: settings.ozow
      ? {
          ...settings.ozow,
          privateKey:
            settings.ozow.privateKey === "" ? undefined : settings.ozow.privateKey,
        }
      : undefined,
    yoco: settings.yoco
      ? {
          ...settings.yoco,
          secretKey: settings.yoco.secretKey === "" ? undefined : settings.yoco.secretKey,
          webhookSecret:
            settings.yoco.webhookSecret === "" ? undefined : settings.yoco.webhookSecret,
        }
      : undefined,
  });

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "UPDATE",
    entity: "SchoolIntegrationConfig",
    entityId: schoolId,
    metadata: { sections: Object.keys(settings) },
  });

  const integrations = await getPublicIntegrationSettings(schoolId);
  return NextResponse.json({ integrations });
}
