import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { subjectSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "classes:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const subjects = await prisma.subject.findMany({
    where: { ...getSchoolFilter(session), isActive: true },
    include: { grade: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ subjects });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "classes:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = subjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const schoolId = await requireSchoolId(session);
  const subject = await prisma.subject.create({
    data: {
      schoolId,
      code: parsed.data.code,
      name: parsed.data.name,
      gradeId: parsed.data.gradeId || null,
      description: parsed.data.description || null,
      credits: parsed.data.credits ?? null,
    },
  });

  return NextResponse.json({ subject }, { status: 201 });
}
