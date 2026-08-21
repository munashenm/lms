import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId, getStudentForSession } from "@/lib/portal-data";
import { DocumentType } from "@prisma/client";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { documentVisibleToLearner } from "@/lib/learner-portal";
import { saveRuntimeUpload } from "@/lib/runtime-uploads";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as DocumentType | null;

  const documents = await prisma.document.findMany({
    where: {
      ...getSchoolFilter(session),
      ...(type && { type }),
    },
    include: { uploader: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (session.role === "STUDENT") {
    const student = await getStudentForSession(session);
    if (!student) return NextResponse.json({ documents: [] });
    const scope = {
      id: student.id,
      gradeId: student.gradeId,
      classId: student.classId,
      campusId: student.campusId,
      courseIds: student.enrolments
        .map((e) => e.courseId)
        .filter((id): id is string => Boolean(id)),
    };
    return NextResponse.json({
      documents: documents.filter((doc) => documentVisibleToLearner(doc, scope)),
    });
  }

  if (session.role === "PARENT") {
    return NextResponse.json({ documents: documents.filter((d) => d.isPublic) });
  }

  return NextResponse.json({ documents });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "classes:write") && session!.role !== "TEACHER") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || null;
  const type = (formData.get("type") as DocumentType) || "LEARNING_MATERIAL";
  const isPublic = formData.get("isPublic") === "true";
  const learnerVisible = formData.get("learnerVisible") === "true";
  const targetGradeId = (formData.get("targetGradeId") as string) || null;
  const targetClassId = (formData.get("targetClassId") as string) || null;
  const targetCampusId = (formData.get("targetCampusId") as string) || null;
  const targetCourseId = (formData.get("targetCourseId") as string) || null;
  const targetStudentId = (formData.get("targetStudentId") as string) || null;

  if (!file || !title) {
    return NextResponse.json({ message: "File and title required" }, { status: 400 });
  }

  const schoolId = await requireSchoolId(session!);
  const denied = await requireLicenseWrite(schoolId);
  if (denied) return denied;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  const fileUrl = await saveRuntimeUpload({
    schoolId,
    filename,
    bytes: buffer,
  });

  const document = await prisma.document.create({
    data: {
      schoolId,
      uploadedBy: session!.userId,
      title,
      description,
      type,
      fileUrl,
      fileSize: buffer.length,
      mimeType: file.type || null,
      isPublic,
      learnerVisible: learnerVisible || isPublic,
      targetGradeId,
      targetClassId,
      targetCampusId,
      targetCourseId,
      targetStudentId,
    },
  });

  return NextResponse.json({ document }, { status: 201 });
}
