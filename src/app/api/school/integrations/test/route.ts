import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import {
  getResolvedIntegrations,
  isSendGridReady,
  isTwilioReady,
  resolveSettingsSchoolId,
} from "@/lib/school-integrations";
import { sendEmailViaSendGrid, sendSmsViaTwilio } from "@/lib/outbound-messaging";

const testSchema = z.object({
  schoolId: z.string().optional(),
  channel: z.enum(["email", "sms"]),
  to: z.string().min(3),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const schoolId = resolveSettingsSchoolId(
    session!,
    parsed.data.schoolId ?? request.nextUrl.searchParams.get("schoolId")
  );

  if (!schoolId) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }

  const config = await getResolvedIntegrations(schoolId);

  try {
    if (parsed.data.channel === "email") {
      if (!isSendGridReady(config)) {
        return NextResponse.json(
          { message: "SendGrid is not enabled or missing credentials" },
          { status: 400 }
        );
      }
      await sendEmailViaSendGrid(
        config,
        parsed.data.to,
        "SchoolHub SA — test email",
        "This is a test email from your SchoolHub SA integration settings."
      );
    } else {
      if (!isTwilioReady(config)) {
        return NextResponse.json(
          { message: "Twilio is not enabled or missing credentials" },
          { status: 400 }
        );
      }
      await sendSmsViaTwilio(
        config,
        parsed.data.to,
        "SchoolHub SA test SMS — your Twilio integration is working."
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[integrations:test]", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Test delivery failed" },
      { status: 502 }
    );
  }
}
