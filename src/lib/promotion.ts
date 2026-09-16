import {
  EnrolmentStatus,
  PromotionEligibility,
  PromotionOutcome,
  StudentStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { attendanceRate, isPresentLike } from "@/lib/attendance";
import { ensureStudentEnrolment } from "@/lib/enrolment";
import { logAudit } from "@/lib/audit";

export const PROMOTION_OUTCOME_LABELS: Record<PromotionOutcome, string> = {
  PROMOTED: "Promoted",
  REPEATED: "Repeated",
  PROGRESSED: "Progressed",
  GRADUATED: "Graduated",
  COMPLETED: "Completed",
  TRANSFERRED: "Transferred",
  WITHDRAWN: "Withdrawn",
  DEFERRED: "Deferred",
};

type RuleCondition = {
  type?: string;
  subjectId?: string;
  minMark?: number;
};

export type PromotionCheck = {
  studentId: string;
  studentName: string;
  studentNumber: string;
  gradeName: string | null;
  className: string | null;
  enrolmentId: string | null;
  fromGradeId: string | null;
  average: number | null;
  attendancePercent: number | null;
  resultStatus: string;
  eligibility: PromotionEligibility;
  reasons: string[];
};

function numberOrNull(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

function passStatus(average: number | null): string {
  if (average == null) return "INCOMPLETE";
  return average >= 50 ? "PASS" : "FAIL";
}

export async function evaluateStudentPromotion(params: {
  schoolId: string;
  studentId: string;
  academicYearId: string;
}): Promise<PromotionCheck | null> {
  const student = await prisma.student.findFirst({
    where: { id: params.studentId, schoolId: params.schoolId },
    include: {
      grade: { select: { id: true, name: true } },
      class: { select: { name: true } },
    },
  });
  if (!student) return null;

  const enrolment = await prisma.enrolment.findFirst({
    where: { studentId: student.id, academicYearId: params.academicYearId },
    orderBy: { updatedAt: "desc" },
  });

  const marks = await prisma.mark.findMany({
    where: {
      studentId: student.id,
      assessment: { term: { academicYearId: params.academicYearId } },
    },
    include: { assessment: { select: { maxMarks: true, subjectId: true, weight: true } } },
  });

  let weighted = 0;
  let weightTotal = 0;
  const subjectScores = new Map<string, { score: number; max: number }>();
  for (const mark of marks) {
    const max = Number(mark.assessment.maxMarks) || 0;
    const score = Number(mark.score) || 0;
    const weight = Number(mark.assessment.weight ?? 1) || 1;
    if (max > 0) {
      weighted += (score / max) * 100 * weight;
      weightTotal += weight;
    }
    if (mark.assessment.subjectId) {
      const current = subjectScores.get(mark.assessment.subjectId) ?? { score: 0, max: 0 };
      current.score += score;
      current.max += max;
      subjectScores.set(mark.assessment.subjectId, current);
    }
  }
  const average = weightTotal > 0 ? Math.round((weighted / weightTotal) * 10) / 10 : null;

  const attendance = await prisma.attendanceRecord.findMany({
    where: { studentId: student.id, term: { academicYearId: params.academicYearId } },
    select: { status: true },
  });
  const presentLike = attendance.filter((row) => isPresentLike(row.status)).length;
  const attendancePercent = attendance.length ? attendanceRate(presentLike, attendance.length) : null;

  const fromGradeId = enrolment?.gradeId ?? student.gradeId;
  const rule = await prisma.promotionRule.findFirst({
    where: {
      schoolId: params.schoolId,
      isActive: true,
      OR: [{ fromGradeId }, { fromGradeId: null }],
    },
    orderBy: { fromGradeId: "desc" },
  });

  const reasons: string[] = [];
  let eligibility: PromotionEligibility = PromotionEligibility.ELIGIBLE;
  const resultStatus = passStatus(average);

  if (!rule) {
    eligibility = PromotionEligibility.REVIEW_REQUIRED;
    reasons.push("No promotion rule is configured for this grade.");
  } else {
    const minAverage = numberOrNull(rule.minAverage);
    if (minAverage != null) {
      if (average == null) {
        eligibility = PromotionEligibility.REVIEW_REQUIRED;
        reasons.push("Overall result is incomplete.");
      } else if (average < minAverage) {
        eligibility = PromotionEligibility.NOT_ELIGIBLE;
        reasons.push(`Overall average ${average}% is below ${minAverage}%.`);
      } else {
        reasons.push(`Overall average ${average}% meets the ${minAverage}% requirement.`);
      }
    }
    const minAttendance = numberOrNull(rule.minAttendancePercent);
    if (minAttendance != null) {
      if (attendancePercent == null) {
        if (eligibility === PromotionEligibility.ELIGIBLE) eligibility = PromotionEligibility.REVIEW_REQUIRED;
        reasons.push("Attendance is incomplete.");
      } else if (attendancePercent < minAttendance) {
        eligibility = PromotionEligibility.NOT_ELIGIBLE;
        reasons.push(`Attendance ${attendancePercent}% is below ${minAttendance}%.`);
      } else {
        reasons.push(`Attendance ${attendancePercent}% meets the ${minAttendance}% requirement.`);
      }
    }
    if (rule.requirePassStatus && resultStatus !== "PASS") {
      eligibility = PromotionEligibility.NOT_ELIGIBLE;
      reasons.push("Final academic status is not PASS.");
    } else if (rule.requirePassStatus) {
      reasons.push("Final academic status is PASS.");
    }
    if (rule.minSubjectsPassed != null) {
      const passed = [...subjectScores.values()].filter((row) => row.max > 0 && (row.score / row.max) * 100 >= 40).length;
      if (passed < rule.minSubjectsPassed) {
        eligibility = PromotionEligibility.NOT_ELIGIBLE;
        reasons.push(`Passed ${passed} subject(s); ${rule.minSubjectsPassed} required.`);
      }
    }
    const conditions = Array.isArray(rule.conditions) ? (rule.conditions as RuleCondition[]) : [];
    for (const condition of conditions) {
      if (condition.type !== "subject_min" || !condition.subjectId || condition.minMark == null) continue;
      const row = subjectScores.get(condition.subjectId);
      const percent = row && row.max > 0 ? (row.score / row.max) * 100 : null;
      if (percent == null || percent < condition.minMark) {
        eligibility = PromotionEligibility.NOT_ELIGIBLE;
        reasons.push(`Required subject mark was not met.`);
      }
    }
  }

  return {
    studentId: student.id,
    studentName: `${student.firstName} ${student.lastName}`,
    studentNumber: student.studentNumber,
    gradeName: student.grade?.name ?? null,
    className: student.class?.name ?? null,
    enrolmentId: enrolment?.id ?? null,
    fromGradeId,
    average,
    attendancePercent,
    resultStatus,
    eligibility,
    reasons,
  };
}

export function outcomeToEnrolmentStatus(outcome: PromotionOutcome): EnrolmentStatus {
  switch (outcome) {
    case PromotionOutcome.PROMOTED:
      return EnrolmentStatus.PROMOTED;
    case PromotionOutcome.REPEATED:
      return EnrolmentStatus.REPEATED;
    case PromotionOutcome.PROGRESSED:
      return EnrolmentStatus.PROGRESSED;
    case PromotionOutcome.GRADUATED:
      return EnrolmentStatus.GRADUATED;
    case PromotionOutcome.COMPLETED:
      return EnrolmentStatus.COMPLETED;
    case PromotionOutcome.TRANSFERRED:
      return EnrolmentStatus.TRANSFERRED;
    case PromotionOutcome.WITHDRAWN:
      return EnrolmentStatus.WITHDRAWN;
    case PromotionOutcome.DEFERRED:
      return EnrolmentStatus.DEFERRED;
    default:
      return EnrolmentStatus.COMPLETED;
  }
}

export function continuesToTarget(outcome: PromotionOutcome): boolean {
  return (
    outcome === PromotionOutcome.PROMOTED ||
    outcome === PromotionOutcome.REPEATED ||
    outcome === PromotionOutcome.PROGRESSED ||
    outcome === PromotionOutcome.DEFERRED
  );
}

export async function commitPromotion(params: {
  schoolId: string;
  studentId: string;
  fromAcademicYearId: string;
  toAcademicYearId?: string | null;
  toGradeId?: string | null;
  toClassId?: string | null;
  outcome: PromotionOutcome;
  overridden?: boolean;
  overrideReason?: string | null;
  notes?: string | null;
  actorId: string;
  check: PromotionCheck;
}) {
  const existing = await prisma.student.findFirst({
    where: { id: params.studentId, schoolId: params.schoolId },
  });
  if (!existing) throw new Error("Student not found");

  if (params.check.enrolmentId) {
    await prisma.enrolment.update({
      where: { id: params.check.enrolmentId },
      data: {
        status: outcomeToEnrolmentStatus(params.outcome),
        completedAt: new Date(),
        notes: params.notes ?? undefined,
      },
    });
  }

  if (continuesToTarget(params.outcome) && params.toAcademicYearId) {
    await ensureStudentEnrolment({
      studentId: params.studentId,
      schoolId: params.schoolId,
      academicYearId: params.toAcademicYearId,
      gradeId: params.toGradeId ?? params.check.fromGradeId,
      classId: params.toClassId ?? null,
      status: EnrolmentStatus.ENROLLED,
      recordedById: params.actorId,
    });
    await prisma.student.update({
      where: { id: params.studentId },
      data: {
        status: StudentStatus.ACTIVE,
        gradeId: params.toGradeId ?? existing.gradeId,
        classId: params.toClassId ?? existing.classId,
      },
    });
  } else if (params.outcome === PromotionOutcome.GRADUATED || params.outcome === PromotionOutcome.COMPLETED) {
    await prisma.student.update({
      where: { id: params.studentId },
      data: { status: StudentStatus.GRADUATED },
    });
  } else if (params.outcome === PromotionOutcome.WITHDRAWN || params.outcome === PromotionOutcome.TRANSFERRED) {
    await prisma.student.update({
      where: { id: params.studentId },
      data: { status: StudentStatus.WITHDRAWN },
    });
  }

  const decision = await prisma.promotionDecision.create({
    data: {
      schoolId: params.schoolId,
      studentId: params.studentId,
      enrolmentId: params.check.enrolmentId,
      fromAcademicYearId: params.fromAcademicYearId,
      toAcademicYearId: params.toAcademicYearId ?? null,
      fromGradeId: params.check.fromGradeId,
      toGradeId: params.toGradeId ?? null,
      toClassId: params.toClassId ?? null,
      eligibility: params.check.eligibility,
      outcome: params.outcome,
      overridden: Boolean(params.overridden),
      overrideReason: params.overrideReason ?? null,
      notes: params.notes ?? null,
      average: params.check.average,
      attendancePercent: params.check.attendancePercent,
      resultStatus: params.check.resultStatus,
      decidedById: params.actorId,
    },
  });

  await logAudit({
    schoolId: params.schoolId,
    userId: params.actorId,
    action: params.overridden ? "PROMOTION_OVERRIDE" : "PROMOTION",
    entity: "Student",
    entityId: params.studentId,
    metadata: {
      outcome: params.outcome,
      eligibility: params.check.eligibility,
      fromYearId: params.fromAcademicYearId,
      toYearId: params.toAcademicYearId,
      overrideReason: params.overrideReason ?? null,
    },
  });

  return decision;
}
