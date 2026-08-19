import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { submissionSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { saveHomeworkSubmissionFile } from "@/lib/homework-upload";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function parseSubmission(request: NextRequest, schoolId: string, studentId: string) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const content = String(form.get("content") ?? "").trim() || undefined;
    const file = form.get("file");
    let fileUrl: string | undefined;
    if (file instanceof File && file.size > 0) {
      fileUrl = await saveHomeworkSubmissionFile(schoolId, studentId, file);
    }
    return { content, fileUrl };
  }

  const parsed = submissionSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new Error("INVALID");
  }
  return {
    content: parsed.data.content?.trim() || undefined,
    fileUrl: parsed.data.fileUrl?.trim() || undefined,
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const student = await getStudentForSession(session);
  if (!student) {
    return NextResponse.json({ message: "Student profile not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(student.schoolId, { feature: "assessments" });
  if (denied) return denied;

  const { id: assignmentId } = await params;

  let payload: { content?: string; fileUrl?: string };
  try {
    payload = await parseSubmission(request, student.schoolId, student.id);
  } catch (err) {
    const message = err instanceof Error && err.message !== "INVALID" ? err.message : "Invalid data";
    return NextResponse.json({ message }, { status: 400 });
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { assessment: true },
  });

  if (!assignment || !assignment.assessment.isPublished) {
    return NextResponse.json({ message: "Assignment not available" }, { status: 404 });
  }

  if (
    assignment.assessment.dueDate &&
    new Date() > assignment.assessment.dueDate &&
    !assignment.allowLate
  ) {
    return NextResponse.json({ message: "Submission deadline has passed" }, { status: 400 });
  }

  const existing = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
  });

  const content = payload.content || existing?.content || null;
  const fileUrl = payload.fileUrl || existing?.fileUrl || null;
  if (!content && !fileUrl) {
    return NextResponse.json(
      { message: "Add written work or attach a file before submitting." },
      { status: 400 }
    );
  }

  const submission = await prisma.assignmentSubmission.upsert({
    where: {
      assignmentId_studentId: { assignmentId, studentId: student.id },
    },
    create: {
      assignmentId,
      studentId: student.id,
      content,
      fileUrl,
    },
    update: {
      content,
      fileUrl,
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ submission }, { status: 201 });
}
