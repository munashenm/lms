import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validators";
import { changePassword } from "@/lib/password-reset";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await changePassword(
    session.userId,
    parsed.data.currentPassword,
    parsed.data.newPassword
  );

  if (!result.ok) {
    return NextResponse.json({ message: "Current password is incorrect" }, { status: 400 });
  }

  await logAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "UPDATE",
    entity: "User",
    entityId: session.userId,
    metadata: { field: "password" },
  });

  return NextResponse.json({ ok: true });
}
