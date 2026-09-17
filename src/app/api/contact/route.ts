import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendOutboundMessage } from "@/lib/notifications";
import { getFeaturedSchool } from "@/lib/public-site";
import { clientIp, rateLimit, rateLimitedJson } from "@/lib/rate-limit";

const contactSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(254),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const limited = rateLimit({ key: `contact:${ip}`, limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limited.ok) {
    const body = rateLimitedJson(limited.retryAfterSec);
    return NextResponse.json(body.body, { status: body.status, headers: body.headers });
  }

  const payload = await request.json();
  const parsed = contactSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid form data" }, { status: 400 });
  }

  const school = await getFeaturedSchool();
  const to = school?.email ?? "admissions@schoolhub.local";
  const { name, email, subject, message } = parsed.data;

  await sendOutboundMessage(
    school?.id,
    "email",
    to,
    `[Contact] ${subject}`,
    `From: ${name} <${email}>\n\n${message}`
  );

  return NextResponse.json({ ok: true });
}
