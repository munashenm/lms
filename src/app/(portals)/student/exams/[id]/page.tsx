import Link from "next/link";
import { notFound } from "next/navigation";
import { AssessmentType } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { examWindow } from "@/lib/learner-portal";
import { ExamSitGate } from "@/components/assessments/exam-sit-gate";
import { evaluateStoredLicense } from "@/lib/licensing/service";
import { isFeatureEnabled } from "@/lib/licensing/portal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentExamSitPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  const student = await getStudentForSession(session!);
  if (!student) notFound();

  const license = await evaluateStoredLicense(student.schoolId).catch(() => null);
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { _count: { select: { questions: true } } },
  });
  if (!assessment || assessment.type !== AssessmentType.EXAM || !assessment.isPublished) {
    notFound();
  }

  const attempt = await prisma.examAttempt.findUnique({
    where: { assessmentId_studentId: { assessmentId: id, studentId: student.id } },
  });
  const window = examWindow({
    availableFrom: assessment.availableFrom,
    dueDate: assessment.dueDate,
    completed: attempt?.status === "SUBMITTED",
  });

  if (!isFeatureEnabled(license, "online_exams") || assessment._count.questions === 0 || window !== "AVAILABLE") {
    return (
      <Card>
        <CardContent className="py-10 space-y-3">
          <p className="text-sm text-muted">This paper is not available to sit online right now.</p>
          <Button variant="outline" asChild>
            <Link href="/student/exams">Back to examinations</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ExamSitGate
      assessmentId={id}
      title={assessment.title}
      durationMinutes={assessment.durationMinutes}
    />
  );
}
