import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTeacherForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { MarksEntry } from "@/components/assessments/marks-entry";
import { PublishButton } from "@/components/assessments/publish-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeacherAssessmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { subject: true, marks: true },
  });

  if (!assessment || (teacher && assessment.teacherId !== teacher.id)) {
    notFound();
  }

  const classIds = teacher?.classTeachers.map((ct) => ct.classId) ?? [];
  const students = await prisma.student.findMany({
    where: { classId: { in: classIds }, status: "ACTIVE" },
    orderBy: { lastName: "asc" },
  });

  const markMap = new Map(assessment.marks.map((m) => [m.studentId, m]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/teacher/assessments"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{assessment.title}</h1>
          <p className="text-muted text-sm">{assessment.subject?.name}</p>
        </div>
        <PublishButton assessmentId={id} isPublished={assessment.isPublished} />
      </div>
      <MarksEntry
        assessmentId={id}
        maxMarks={Number(assessment.maxMarks)}
        students={students.map((s) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          studentNumber: s.studentNumber,
          existingScore: markMap.get(s.id) ? Number(markMap.get(s.id)!.score) : undefined,
        }))}
      />
    </div>
  );
}
