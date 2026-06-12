import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validators";
import { createPasswordResetRequest } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid email" }, { status: 400 });
  }

  await createPasswordResetRequest(parsed.data.email);

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });
}
