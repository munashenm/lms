import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendOutboundMessage } from "@/lib/notifications";
import { getFeaturedSchool } from "@/lib/public-site";

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.string().min(3),
  message: z.string().min(10),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = contactSchema.safeParse(body);
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
