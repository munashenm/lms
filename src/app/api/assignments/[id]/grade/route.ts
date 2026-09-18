import { NextRequest, NextResponse } from "next/server";
import { AssignmentSubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireStaffPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { assessmentSchoolInclude } from "@/lib/tenant";

interface Params {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  submissionId: z.string().min(1),
  grade: z.coerce.number().min(0).optional(),
  feedback: z.string().max(4000).optional(),
  status: z.enum(["GRADED", "RETURNED", "LATE"]).optional(),
});

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requireStaffPermission(session, "homework.grade") && !requireStaffPermission(session, "marks:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      assessment: { include: { ...assessmentSchoolInclude, subject: { select: { name: true } } } },
      submissions: {
        include: { student: { select: { firstName: true, lastName: true, studentNumber: true } } },
        orderBy: { submittedAt: "desc" },
      },
    },
  });
  if (!assignment) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (session!.schoolId && assignment.assessment.schoolId !== session!.schoolId) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ assignment });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requireStaffPermission(session, "homework.grade") && !requireStaffPermission(session, "marks:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const submission = await prisma.assignmentSubmission.findFirst({
    where: { id: parsed.data.submissionId, assignmentId: id },
    include: { assignment: { include: { assessment: true } } },
  });
  if (!submission) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (session!.schoolId && submission.assignment.assessment.schoolId !== session!.schoolId) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const status =
    parsed.data.status === "RETURNED"
      ? AssignmentSubmissionStatus.RETURNED
      : parsed.data.status === "LATE"
        ? AssignmentSubmissionStatus.LATE
        : AssignmentSubmissionStatus.GRADED;

  const updated = await prisma.assignmentSubmission.update({
    where: { id: submission.id },
    data: {
      grade: parsed.data.grade ?? submission.grade,
      feedback: parsed.data.feedback ?? submission.feedback,
      status,
      returnedAt: status === AssignmentSubmissionStatus.RETURNED ? new Date() : submission.returnedAt,
    },
  });
  await logAudit({
    schoolId: submission.assignment.assessment.schoolId,
    userId: session!.userId,
    action: "HOMEWORK_GRADED",
    entity: "AssignmentSubmission",
    entityId: submission.id,
    metadata: { grade: parsed.data.grade, status },
  });
  return NextResponse.json({ submission: updated });
}
