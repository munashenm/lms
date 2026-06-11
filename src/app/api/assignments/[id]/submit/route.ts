import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { submissionSchema } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
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

  const { id: assignmentId } = await params;
  const body = await request.json();
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
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

  const submission = await prisma.assignmentSubmission.upsert({
    where: {
      assignmentId_studentId: { assignmentId, studentId: student.id },
    },
    create: {
      assignmentId,
      studentId: student.id,
      content: parsed.data.content || null,
      fileUrl: parsed.data.fileUrl || null,
    },
    update: {
      content: parsed.data.content || null,
      fileUrl: parsed.data.fileUrl || null,
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ submission }, { status: 201 });
}
