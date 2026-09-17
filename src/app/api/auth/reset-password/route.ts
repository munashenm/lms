import { NextRequest, NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/validators";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { clientIp, rateLimit, rateLimitedJson } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const limited = rateLimit({ key: `reset:${ip}`, limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limited.ok) {
    const body = rateLimitedJson(limited.retryAfterSec);
    return NextResponse.json(body.body, { status: body.status, headers: body.headers });
  }

  const payload = await request.json();
  const parsed = resetPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json(
      { message: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
