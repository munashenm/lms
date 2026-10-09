import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import {
  getResolvedIntegrations,
  isTwilioReady,
  resolveSettingsSchoolId,
} from "@/lib/school-integrations";
import { deliverEmail } from "@/lib/email/deliver";
import { EMAIL_PROVIDER_NOT_CONFIGURED } from "@/lib/email/resolve-provider";
import { sendSmsViaTwilio } from "@/lib/outbound-messaging";
import { requireLicenseMutation } from "@/lib/licensing/enforce";

const testSchema = z.object({
  schoolId: z.string().optional(),
  channel: z.enum(["email", "sms"]),
  to: z.string().min(3),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  const __licSchoolId = session?.schoolId ?? null;
  if (__licSchoolId) {
    const __licDenied = await requireLicenseMutation(__licSchoolId, {
      pathname: "/api/school/integrations/test",
      method: "POST",
    });
    if (__licDenied) return __licDenied;
  }

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
      const result = await deliverEmail(config.email, {
        to: parsed.data.to,
        subject: "SchoolHub SA — test email",
        text: "This is a test email from your SchoolHub SA integration settings.",
      });
      if (!result.sent) {
        const notConfigured = result.reason === EMAIL_PROVIDER_NOT_CONFIGURED;
        return NextResponse.json(
          {
            message: notConfigured
              ? "EMAIL_PROVIDER_NOT_CONFIGURED"
              : result.reason ?? "Test delivery failed",
            provider: result.provider,
            configured: config.email.configured,
            senderValid: config.email.senderValid,
          },
          { status: notConfigured || result.reason === "invalid_sender" ? 400 : 502 }
        );
      }
      return NextResponse.json({
        ok: true,
        provider: result.provider,
        acceptance: result.acceptance,
        messageId: result.messageId,
        fromEmail: result.fromEmail,
        replyTo: result.replyTo,
      });
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
    const { sanitizeEmailDetail } = await import("@/lib/email/sanitize");
    const message = sanitizeEmailDetail(err instanceof Error ? err.message : "Test delivery failed", [
      config.email.apiKey,
    ]);
    console.error("[integrations:test]", message);
    return NextResponse.json({ message }, { status: 502 });
  }
}
