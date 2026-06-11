import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { gradeSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "classes:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const grades = await prisma.grade.findMany({
    where: { ...getSchoolFilter(session), isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { subjects: true, students: true } } },
  });

  return NextResponse.json({ grades });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "classes:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = gradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const schoolId = await requireSchoolId(session);
  const grade = await prisma.grade.create({
    data: { schoolId, ...parsed.data },
  });

  return NextResponse.json({ grade }, { status: 201 });
}
