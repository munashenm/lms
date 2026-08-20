import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { validateStudentPhoto } from "@/lib/registration-docs";
import { saveRegistrationFile } from "@/lib/registration-uploads";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "students:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || !canAccessSchool(session!, student.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Photo file required" }, { status: 400 });
  }
  const invalid = validateStudentPhoto(file);
  if (invalid) return NextResponse.json({ message: invalid }, { status: 400 });

  const saved = await saveRegistrationFile({
    schoolId: student.schoolId,
    folder: `students/${id}`,
    file,
  });

  const updated = await prisma.student.update({
    where: { id },
    data: { photoUrl: saved.url },
  });

  await logAudit({
    schoolId: student.schoolId,
    userId: session!.userId,
    action: "STUDENT_PHOTO_UPLOADED",
    entity: "Student",
    entityId: id,
    metadata: { photoUrl: saved.url },
  });

  return NextResponse.json({ student: updated, photoUrl: saved.url });
}
