import {
  AcademicSessionStatus,
  EnrolmentStatus,
  StudentStatus,
  type Grade,
  type Prisma,
} from "@prisma/client";
import { prisma } from "./db";
import { setCurrentAcademicSession } from "./academic-session";
import type { RolloverOutcome } from "./rollover-shared";

export type { RolloverOutcome } from "./rollover-shared";
export { ROLLOVER_OUTCOME_LABELS } from "./rollover-shared";

export type RolloverDecision = {
  enrolmentId: string;
  studentId: string;
  outcome: RolloverOutcome;
  targetGradeId?: string | null;
  targetClassId?: string | null;
  targetCourseId?: string | null;
  notes?: string | null;
};

type GradeRow = Pick<Grade, "id" | "name" | "level" | "sortOrder">;

function sortGrades(grades: GradeRow[]): GradeRow[] {
  return [...grades].sort((a, b) => {
    const aKey = a.level ?? a.sortOrder;
    const bKey = b.level ?? b.sortOrder;
    if (aKey !== bKey) return aKey - bKey;
    return a.name.localeCompare(b.name);
  });
}

export function suggestNextGrade(
  currentGradeId: string | null | undefined,
  grades: GradeRow[]
): GradeRow | null {
  if (!currentGradeId) return null;
  const ordered = sortGrades(grades);
  const index = ordered.findIndex((g) => g.id === currentGradeId);
  if (index < 0) return null;
  return ordered[index + 1] ?? null;
}

export function outcomeToEnrolmentStatus(outcome: RolloverOutcome): EnrolmentStatus {
  switch (outcome) {
    case "PROMOTED":
      return EnrolmentStatus.PROMOTED;
    case "REPEATED":
      return EnrolmentStatus.REPEATED;
    case "GRADUATED":
      return EnrolmentStatus.GRADUATED;
    case "WITHDRAWN":
      return EnrolmentStatus.WITHDRAWN;
    case "TRANSFERRED":
      return EnrolmentStatus.TRANSFERRED;
    case "COMPLETED":
      return EnrolmentStatus.COMPLETED;
  }
}

export function outcomeToStudentStatus(outcome: RolloverOutcome): StudentStatus | null {
  switch (outcome) {
    case "GRADUATED":
      return StudentStatus.GRADUATED;
    case "WITHDRAWN":
    case "TRANSFERRED":
      return StudentStatus.WITHDRAWN;
    case "COMPLETED":
      return StudentStatus.GRADUATED;
    default:
      return null;
  }
}

export function continuesToTarget(outcome: RolloverOutcome): boolean {
  return outcome === "PROMOTED" || outcome === "REPEATED";
}

const previewInclude = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentNumber: true,
      status: true,
      gradeId: true,
      classId: true,
    },
  },
  grade: { select: { id: true, name: true, level: true, sortOrder: true } },
  class: { select: { id: true, name: true } },
  course: { select: { id: true, code: true, name: true } },
} satisfies Prisma.EnrolmentInclude;

export async function buildRolloverPreview(params: {
  schoolId: string;
  sourceYearId: string;
  targetYearId: string;
  gradeId?: string | null;
  classId?: string | null;
}) {
  const [sourceYear, targetYear, grades, targetClasses, enrolments] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { id: params.sourceYearId, schoolId: params.schoolId },
    }),
    prisma.academicYear.findFirst({
      where: { id: params.targetYearId, schoolId: params.schoolId },
    }),
    prisma.grade.findMany({
      where: { schoolId: params.schoolId, isActive: true },
      select: { id: true, name: true, level: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.class.findMany({
      where: {
        schoolId: params.schoolId,
        isActive: true,
        OR: [{ academicYearId: params.targetYearId }, { academicYearId: null }],
      },
      select: {
        id: true,
        name: true,
        gradeId: true,
        academicYearId: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.enrolment.findMany({
      where: {
        academicYearId: params.sourceYearId,
        status: EnrolmentStatus.ENROLLED,
        student: { schoolId: params.schoolId, status: StudentStatus.ACTIVE },
        ...(params.gradeId ? { gradeId: params.gradeId } : {}),
        ...(params.classId ? { classId: params.classId } : {}),
      },
      include: previewInclude,
      orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
    }),
  ]);

  if (!sourceYear || !targetYear) {
    throw new Error("Source or target academic session not found");
  }

  if (sourceYear.id === targetYear.id) {
    throw new Error("Source and target sessions must be different");
  }

  const suggestions = enrolments.map((enrolment) => {
    const currentGradeId = enrolment.gradeId ?? enrolment.student.gradeId;
    const nextGrade = suggestNextGrade(currentGradeId, grades);
    const suggestedGradeId = nextGrade?.id ?? currentGradeId ?? null;

    const matchingClass =
      suggestedGradeId && enrolment.class
        ? targetClasses.find(
            (c) =>
              c.gradeId === suggestedGradeId &&
              c.name === enrolment.class!.name &&
              (c.academicYearId === params.targetYearId || c.academicYearId === null)
          )
        : null;

    return {
      enrolmentId: enrolment.id,
      studentId: enrolment.studentId,
      studentNumber: enrolment.student.studentNumber,
      firstName: enrolment.student.firstName,
      lastName: enrolment.student.lastName,
      currentGradeId,
      currentGradeName: enrolment.grade?.name ?? null,
      currentClassId: enrolment.classId ?? enrolment.student.classId,
      currentClassName: enrolment.class?.name ?? null,
      courseId: enrolment.courseId,
      courseName: enrolment.course
        ? `${enrolment.course.code} — ${enrolment.course.name}`
        : null,
      suggestedOutcome: (nextGrade ? "PROMOTED" : "GRADUATED") as RolloverOutcome,
      suggestedGradeId,
      suggestedGradeName: nextGrade?.name ?? enrolment.grade?.name ?? null,
      suggestedClassId: matchingClass?.id ?? null,
      suggestedClassName: matchingClass?.name ?? null,
    };
  });

  return {
    sourceYear: {
      id: sourceYear.id,
      name: sourceYear.name,
      status: sourceYear.status,
      isCurrent: sourceYear.isCurrent,
    },
    targetYear: {
      id: targetYear.id,
      name: targetYear.name,
      status: targetYear.status,
      isCurrent: targetYear.isCurrent,
    },
    grades: sortGrades(grades),
    classes: targetClasses,
    students: suggestions,
  };
}

export async function commitRollover(params: {
  schoolId: string;
  sourceYearId: string;
  targetYearId: string;
  decisions: RolloverDecision[];
  activateTarget?: boolean;
  closeSource?: boolean;
  userId?: string;
}) {
  const preview = await buildRolloverPreview({
    schoolId: params.schoolId,
    sourceYearId: params.sourceYearId,
    targetYearId: params.targetYearId,
  });

  const allowedIds = new Set(preview.students.map((s) => s.enrolmentId));
  const decisions = params.decisions.filter((d) => allowedIds.has(d.enrolmentId));

  if (decisions.length === 0) {
    throw new Error("No valid enrolment decisions to process");
  }

  const summary = {
    processed: 0,
    promoted: 0,
    repeated: 0,
    graduated: 0,
    withdrawn: 0,
    transferred: 0,
    completed: 0,
    skippedExistingTarget: 0,
  };

  await prisma.$transaction(async (tx) => {
    for (const decision of decisions) {
      const sourceEnrolment = await tx.enrolment.findUnique({
        where: { id: decision.enrolmentId },
        include: { student: true },
      });
      if (!sourceEnrolment || sourceEnrolment.academicYearId !== params.sourceYearId) {
        continue;
      }

      const enrolmentStatus = outcomeToEnrolmentStatus(decision.outcome);
      await tx.enrolment.update({
        where: { id: sourceEnrolment.id },
        data: {
          status: enrolmentStatus,
          completedAt: new Date(),
          notes: decision.notes ?? sourceEnrolment.notes,
        },
      });

      const studentStatus = outcomeToStudentStatus(decision.outcome);
      if (studentStatus) {
        await tx.student.update({
          where: { id: sourceEnrolment.studentId },
          data: { status: studentStatus },
        });
      }

      if (continuesToTarget(decision.outcome)) {
        const targetGradeId =
          decision.outcome === "REPEATED"
            ? decision.targetGradeId ?? sourceEnrolment.gradeId ?? sourceEnrolment.student.gradeId
            : decision.targetGradeId ?? null;

        const targetClassId = decision.targetClassId ?? null;
        const targetCourseId =
          decision.targetCourseId ?? sourceEnrolment.courseId ?? null;

        const existingTarget = await tx.enrolment.findFirst({
          where: {
            studentId: sourceEnrolment.studentId,
            academicYearId: params.targetYearId,
            ...(targetCourseId ? { courseId: targetCourseId } : { courseId: null }),
          },
        });

        if (existingTarget) {
          summary.skippedExistingTarget += 1;
        } else {
          await tx.enrolment.create({
            data: {
              studentId: sourceEnrolment.studentId,
              academicYearId: params.targetYearId,
              courseId: targetCourseId,
              gradeId: targetGradeId,
              classId: targetClassId,
              status: EnrolmentStatus.ENROLLED,
              notes: decision.notes ?? null,
            },
          });
        }

        await tx.student.update({
          where: { id: sourceEnrolment.studentId },
          data: {
            status: StudentStatus.ACTIVE,
            gradeId: targetGradeId,
            classId: targetClassId,
          },
        });
      }

      summary.processed += 1;
      if (decision.outcome === "PROMOTED") summary.promoted += 1;
      if (decision.outcome === "REPEATED") summary.repeated += 1;
      if (decision.outcome === "GRADUATED") summary.graduated += 1;
      if (decision.outcome === "WITHDRAWN") summary.withdrawn += 1;
      if (decision.outcome === "TRANSFERRED") summary.transferred += 1;
      if (decision.outcome === "COMPLETED") summary.completed += 1;
    }

    if (params.closeSource) {
      await tx.academicYear.update({
        where: { id: params.sourceYearId },
        data: {
          status: AcademicSessionStatus.CLOSED,
          isCurrent: false,
          closedAt: new Date(),
        },
      });
    }
  });

  if (params.activateTarget) {
    await setCurrentAcademicSession(params.schoolId, params.targetYearId);
  }

  return { summary, sourceYear: preview.sourceYear, targetYear: preview.targetYear };
}
