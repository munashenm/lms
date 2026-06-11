import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { courseSchema, moduleSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "classes:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const courses = await prisma.course.findMany({
    where: { ...getSchoolFilter(session), isActive: true },
    include: {
      modules: { orderBy: { sortOrder: "asc" } },
      _count: { select: { enrolments: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ courses });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "classes:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const schoolId = await requireSchoolId(session);
  const course = await prisma.course.create({
    data: {
      schoolId,
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description || null,
      nqfLevel: parsed.data.nqfLevel ?? null,
      durationMonths: parsed.data.durationMonths ?? null,
    },
  });

  return NextResponse.json({ course }, { status: 201 });
}
