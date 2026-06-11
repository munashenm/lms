import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MarksEntry } from "@/components/assessments/marks-entry";
import { PublishButton } from "@/components/assessments/publish-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AssessmentDetailPage({ params }: PageProps) {
  const { id } = await params;

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      subject: true,
      term: true,
      marks: true,
      assignment: true,
    },
  });

  if (!assessment) notFound();

  const students = await prisma.student.findMany({
    where: {
      status: "ACTIVE",
      ...(assessment.subjectId && {
        class: {
          classSubjects: { some: { subjectId: assessment.subjectId } },
        },
      }),
    },
    orderBy: { lastName: "asc" },
  });

  const markMap = new Map(assessment.marks.map((m) => [m.studentId, m]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/assessments"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{assessment.title}</h1>
            <Badge>{assessment.type}</Badge>
            <Badge variant={assessment.isPublished ? "success" : "secondary"}>
              {assessment.isPublished ? "Published" : "Draft"}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            {assessment.subject?.name} · Max {Number(assessment.maxMarks)} marks
            {assessment.weight && ` · Weight ${Number(assessment.weight)}%`}
          </p>
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
          existingSymbol: markMap.get(s.id)?.gradeSymbol ?? undefined,
        }))}
      />
    </div>
  );
}
