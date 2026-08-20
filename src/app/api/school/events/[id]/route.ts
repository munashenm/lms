import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "announcements:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.schoolEvent.findFirst({
    where: { id, ...getSchoolFilter(session!) },
  });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId);
  if (denied) return denied;

  await prisma.schoolEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
