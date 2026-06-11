import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "staff:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const teachers = await prisma.teacher.findMany({
    where: { ...getSchoolFilter(session), status: "ACTIVE" },
    include: {
      campus: { select: { name: true } },
      classTeachers: { include: { class: { select: { name: true } } } },
    },
    orderBy: { lastName: "asc" },
  });

  return NextResponse.json({ teachers });
}
