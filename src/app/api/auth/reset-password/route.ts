import { NextRequest, NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/validators";
import { resetPasswordWithToken } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = resetPasswordSchema.safeParse(body);
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
