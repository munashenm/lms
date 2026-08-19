import { AssessmentType, DayOfWeek, InstalmentStatus } from "@prisma/client";
import { prisma } from "./db";
import { getStudentLedger } from "./student-ledger";
import { getOutstandingBalance } from "./finance";
import { attendanceSummary, assignmentLearnerStatus, curriculumProgress, examWindow } from "./learner-portal";
import { getTodayDayOfWeek } from "./timetable-conflicts";

export async function getLearnerDashboardData(student: {
  id: string;
  schoolId: string;
  classId: string | null;
  gradeId: string | null;
  campusId: string | null;
}) {
  const now = new Date();
  const today = getTodayDayOfWeek();

  const [
    attendanceRecords,
    marks,
    invoices,
    instalments,
    assignments,
    exams,
    announcements,
    slots,
    ledger,
    topics,
  ] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { studentId: student.id },
      select: { status: true },
    }),
    prisma.mark.findMany({
      where: { studentId: student.id, assessment: { isPublished: true } },
      include: {
        assessment: {
          include: { subject: { select: { id: true, name: true, code: true } } },
        },
      },
    }),
    prisma.invoice.findMany({
      where: { studentId: student.id, status: { not: "DRAFT" } },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.chargeInstalment.findMany({
      where: {
        charge: { studentId: student.id, reversedAt: null },
        status: { in: [InstalmentStatus.PENDING, InstalmentStatus.PARTIAL] },
      },
      include: { charge: { select: { description: true } } },
      orderBy: { dueDate: "asc" },
      take: 3,
    }),
    prisma.assignment.findMany({
      where: {
        assessment: {
          isPublished: true,
          type: "ASSIGNMENT",
          OR: [
            { subject: { schoolId: student.schoolId } },
            { module: { course: { schoolId: student.schoolId } } },
          ],
        },
      },
      include: {
        assessment: { include: { subject: { select: { name: true } } } },
        submissions: { where: { studentId: student.id } },
      },
      orderBy: { assessment: { dueDate: "asc" } },
      take: 40,
    }),
    prisma.assessment.findMany({
      where: {
        isPublished: true,
        type: AssessmentType.EXAM,
        OR: [
          { subject: { schoolId: student.schoolId } },
          { module: { course: { schoolId: student.schoolId } } },
        ],
      },
      include: { subject: { select: { name: true } }, teacher: { select: { firstName: true, lastName: true } } },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.announcement.findMany({
      where: {
        schoolId: student.schoolId,
        audience: { in: ["ALL", "STUDENTS"] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }],
      take: 5,
    }),
    prisma.timetableSlot.findMany({
          where: { classId: student.classId ?? "__none__", dayOfWeek: today as DayOfWeek },
          include: {
            subject: { select: { id: true, name: true } },
            module: { select: { name: true } },
            teacher: { select: { firstName: true, lastName: true } },
          },
          orderBy: { startTime: "asc" },
        }),
    getStudentLedger({ studentId: student.id, take: 8 }),
    prisma.curriculumTopic.findMany({
      where: {
        schoolId: student.schoolId,
        OR: [
          { classId: student.classId ?? "__none__" },
          { classId: null, subject: { gradeId: student.gradeId ?? undefined } },
          { classId: null },
        ],
      },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const attendance = attendanceSummary(attendanceRecords);

  const bySubject = new Map<string, { id: string; name: string; scores: number[] }>();
  for (const mark of marks) {
    const subject = mark.assessment.subject;
    if (!subject) continue;
    const pct = Math.round((Number(mark.score) / Number(mark.assessment.maxMarks)) * 100);
    const current = bySubject.get(subject.id) ?? { id: subject.id, name: subject.name, scores: [] };
    current.scores.push(pct);
    bySubject.set(subject.id, current);
  }
  const academicProgress = [...bySubject.values()].map((row) => ({
    id: row.id,
    name: row.name,
    average: Math.round(row.scores.reduce((a, b) => a + b, 0) / row.scores.length),
  }));
  const currentAverage =
    academicProgress.length > 0
      ? Math.round(academicProgress.reduce((s, r) => s + r.average, 0) / academicProgress.length)
      : null;

  const outstandingFees = invoices.reduce(
    (sum, invoice) => sum + getOutstandingBalance(Number(invoice.total), Number(invoice.amountPaid)),
    0
  );
  const overdueFees = invoices
    .filter((invoice) => invoice.dueDate && invoice.dueDate < now && getOutstandingBalance(Number(invoice.total), Number(invoice.amountPaid)) > 0)
    .reduce(
      (sum, invoice) => sum + getOutstandingBalance(Number(invoice.total), Number(invoice.amountPaid)),
      0
    );
  const payInvoice = invoices.find(
    (invoice) => getOutstandingBalance(Number(invoice.total), Number(invoice.amountPaid)) > 0
  );

  const assignmentItems = assignments.map((row) => {
    const sub = row.submissions[0];
    const status = assignmentLearnerStatus({
      submitted: Boolean(sub),
      submittedAt: sub?.submittedAt,
      dueDate: row.assessment.dueDate,
      grade: sub?.grade ? Number(sub.grade) : null,
      feedback: sub?.feedback,
      now,
    });
    return {
      assignmentId: row.id,
      title: row.assessment.title,
      subject: row.assessment.subject?.name ?? "General",
      dueDate: row.assessment.dueDate,
      status,
    };
  });
  const pendingAssignments = assignmentItems.filter((a) =>
    ["NOT_STARTED", "IN_PROGRESS", "OVERDUE"].includes(a.status)
  );

  const upcomingExams = exams
    .map((exam) => ({
      id: exam.id,
      title: exam.title,
      subject: exam.subject?.name ?? "Exam",
      dueDate: exam.dueDate,
      venue: exam.venue,
      durationMinutes: exam.durationMinutes,
      window: examWindow({
        availableFrom: exam.availableFrom,
        dueDate: exam.dueDate,
        completed: Boolean(exam.dueDate && exam.dueDate < now),
        now,
      }),
    }))
    .filter((exam) => exam.window !== "COMPLETED")
    .slice(0, 4);

  const progressBySubject = new Map<string, { id: string; name: string; topics: { status: string }[] }>();
  for (const topic of topics) {
    const current = progressBySubject.get(topic.subjectId) ?? {
      id: topic.subject.id,
      name: topic.subject.name,
      topics: [],
    };
    current.topics.push({ status: topic.status });
    progressBySubject.set(topic.subjectId, current);
  }

  return {
    attendance,
    currentAverage,
    academicProgress,
    curriculum: [...progressBySubject.values()].map((row) => ({
      id: row.id,
      name: row.name,
      ...curriculumProgress(row.topics),
    })),
    outstandingFees,
    overdueFees,
    nextInstalment: instalments[0]
      ? {
          dueDate: instalments[0].dueDate,
          amount: Number(instalments[0].amount) - Number(instalments[0].amountPaid),
          description: instalments[0].charge.description,
        }
      : null,
    payInvoiceId: payInvoice?.id ?? null,
    payOutstanding: payInvoice
      ? getOutstandingBalance(Number(payInvoice.total), Number(payInvoice.amountPaid))
      : 0,
    pendingAssignments,
    upcomingExams,
    announcements,
    todaySlots: slots,
    ledgerBalance: ledger.balance,
    latestResults: marks.slice(0, 5).map((m) => ({
      id: m.id,
      title: m.assessment.title,
      subject: m.assessment.subject?.name ?? "—",
      score: Number(m.score),
      maxMarks: Number(m.assessment.maxMarks),
      symbol: m.gradeSymbol,
    })),
  };
}
