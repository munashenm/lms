import { NextRequest, NextResponse } from "next/server";
import { StudentDocumentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { validateRegistrationDocument } from "@/lib/registration-docs";
import { saveRegistrationFile } from "@/lib/registration-uploads";

interface Params {
  params: Promise<{ id: string }>;
}

const TYPES = new Set<string>(Object.values(StudentDocumentType));

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "students:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: { documents: { orderBy: { createdAt: "desc" } } },
  });
  if (!student || !canAccessSchool(session, student.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ documents: student.documents });
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

  const formData = await request.formData();
  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? StudentDocumentType.OTHER);
  const type = TYPES.has(typeRaw) ? (typeRaw as StudentDocumentType) : StudentDocumentType.OTHER;

  if (!(file instanceof File) || !title) {
    return NextResponse.json({ message: "File and title required" }, { status: 400 });
  }
  const invalid = validateRegistrationDocument(file);
  if (invalid) return NextResponse.json({ message: invalid }, { status: 400 });

  const saved = await saveRegistrationFile({
    schoolId: student.schoolId,
    folder: `students/${id}`,
    file,
  });

  const document = await prisma.studentDocument.create({
    data: {
      studentId: id,
      type,
      title,
      fileUrl: saved.url,
      mimeType: saved.mimeType || null,
      fileSize: saved.fileSize,
    },
  });
  await logAudit({
    schoolId: student.schoolId,
    userId: session!.userId,
    action: "STUDENT_DOCUMENT_UPLOADED",
    entity: "StudentDocument",
    entityId: document.id,
    metadata: { studentId: id, type, title },
  });
  return NextResponse.json({ document }, { status: 201 });
}
