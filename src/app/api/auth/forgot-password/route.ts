import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validators";
import { createPasswordResetRequest } from "@/lib/password-reset";
import { clientIp, rateLimit, rateLimitedJson } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const limited = rateLimit({ key: `forgot:${ip}`, limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limited.ok) {
    const body = rateLimitedJson(limited.retryAfterSec);
    return NextResponse.json(body.body, { status: body.status, headers: body.headers });
  }

  const payload = await request.json();
  const parsed = forgotPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid email" }, { status: 400 });
  }

  await createPasswordResetRequest(parsed.data.email);

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });
}
