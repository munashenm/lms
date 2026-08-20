import { notifyStudentGuardians, notifyUser } from "./notifications";
import { getDocumentRelease, type DocumentRelease } from "./fee-clearance";
import { prisma } from "./db";

export type AcademicDocumentKind = "report" | "certificate" | "letter";

const LINKS: Record<AcademicDocumentKind, { student: string; parent: string; label: string }> = {
  report: { student: "/student/report-cards", parent: "/parent/report-cards", label: "Report" },
  certificate: { student: "/student/certificates", parent: "/parent/certificates", label: "Certificate" },
  letter: { student: "/student/letters", parent: "/parent/letters", label: "Letter" },
};

export function academicDocumentNotice(opts: {
  kind: AcademicDocumentKind;
  title: string;
  released: boolean;
}) {
  const meta = LINKS[opts.kind];
  if (opts.released) {
    return {
      title: `${meta.label} is ready`,
      studentMessage: `${opts.title} is available to download.`,
      parentMessage: `${opts.title} is available to download.`,
      studentLink: meta.student,
      parentLink: meta.parent,
    };
  }
  return {
    title: `${meta.label} issued`,
    studentMessage: `${opts.title} has been issued. It will be available to download when school fees are paid in full.`,
    parentMessage: `${opts.title} has been issued. It will be available to download when school fees are paid in full.`,
    studentLink: "/student/fees",
    parentLink: "/parent/fees",
  };
}

export async function notifyAcademicDocumentFamily(opts: {
  studentId: string;
  schoolId: string;
  kind: AcademicDocumentKind;
  title: string;
}) {
  const [student, release] = await Promise.all([
    prisma.student.findUnique({
      where: { id: opts.studentId },
      select: { userId: true },
    }),
    getDocumentRelease(opts.studentId),
  ]);
  const notice = academicDocumentNotice({
    kind: opts.kind,
    title: opts.title,
    released: release.released,
  });
  if (student?.userId) {
    await notifyUser({
      userId: student.userId,
      schoolId: opts.schoolId,
      title: notice.title,
      message: notice.studentMessage,
      type: "ACADEMIC",
      link: notice.studentLink,
    });
  }
  await notifyStudentGuardians({
    studentId: opts.studentId,
    schoolId: opts.schoolId,
    title: notice.title,
    message: notice.parentMessage,
    type: "ACADEMIC",
    link: notice.parentLink,
  });
}

export function shouldNotifyDocumentsReleased(previous: DocumentRelease, current: DocumentRelease) {
  return Boolean(current.requireFees && current.released && !previous.released);
}

export async function notifyDocumentsReleasedIfClear(opts: {
  studentId: string;
  schoolId: string;
  studentUserId?: string | null;
  previous: DocumentRelease;
}) {
  const release = await getDocumentRelease(opts.studentId);
  if (!shouldNotifyDocumentsReleased(opts.previous, release)) return false;

  const title = "Reports and letters are available";
  const message =
    "School fees are paid in full. Report cards, certificates and letters are available to download.";
  if (opts.studentUserId) {
    await notifyUser({
      userId: opts.studentUserId,
      schoolId: opts.schoolId,
      title,
      message,
      type: "ACADEMIC",
      link: "/student/report-cards",
    });
  }
  await notifyStudentGuardians({
    studentId: opts.studentId,
    schoolId: opts.schoolId,
    title,
    message,
    type: "ACADEMIC",
    link: "/parent/report-cards",
  });
  return true;
}
