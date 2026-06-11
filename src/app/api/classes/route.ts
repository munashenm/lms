import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { classSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "classes:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const classes = await prisma.class.findMany({
    where: { ...getSchoolFilter(session), isActive: true },
    include: {
      grade: { select: { name: true } },
      campus: { select: { name: true } },
      academicYear: { select: { name: true } },
      classTeachers: {
        include: { teacher: { select: { firstName: true, lastName: true } } },
      },
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ classes });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "classes:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = classSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        errors[i.path[0]?.toString() ?? "form"] = i.message;
      });
      return NextResponse.json({ errors }, { status: 400 });
    }

    const schoolId = await requireSchoolId(session);
    const data = parsed.data;

    const cls = await prisma.class.create({
      data: {
        schoolId,
        name: data.name,
        gradeId: data.gradeId || null,
        campusId: data.campusId || null,
        academicYearId: data.academicYearId || null,
        capacity: data.capacity ?? null,
        room: data.room || null,
      },
      include: { grade: true, campus: true },
    });

    await logAudit({
      schoolId,
      userId: session.userId,
      action: "CREATE",
      entity: "Class",
      entityId: cls.id,
    });

    return NextResponse.json({ class: cls }, { status: 201 });
  } catch (error) {
    console.error("Create class error:", error);
    return NextResponse.json({ message: "Failed to create class" }, { status: 500 });
  }
}
