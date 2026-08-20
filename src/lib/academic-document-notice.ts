import { notifyStudentGuardians, notifyUser, sendOutboundMessage } from "./notifications";
import { getDocumentRelease, type DocumentRelease } from "./fee-clearance";
import { prisma } from "./db";

export type AcademicDocumentKind = "report" | "certificate" | "letter";

const LINKS: Record<AcademicDocumentKind, { student: string; parent: string; label: string }> = {
  report: { student: "/student/report-cards", parent: "/parent/report-cards", label: "Report" },
  certificate: { student: "/student/certificates", parent: "/parent/certificates", label: "Certificate" },
  letter: { student: "/student/letters", parent: "/parent/letters", label: "Letter" },
};

export const DOCUMENTS_RELEASED_NOTICE = {
  title: "Reports and letters are available",
  message:
    "School fees are paid in full. Report cards, certificates and letters are available to download.",
  studentLink: "/student/report-cards",
  parentLink: "/parent/report-cards",
} as const;

export type FamilyEmailRecipient = {
  email: string;
  audience: "student" | "parent";
};

type FamilyEmailSource = {
  email?: string | null;
  user?: { email?: string | null } | null;
  guardians?: Array<{
    guardian: {
      email?: string | null;
      user?: { email?: string | null } | null;
    };
  }>;
};

export function appBaseUrl(appUrl?: string) {
  return (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function absolutePortalUrl(path: string, appUrl?: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${appBaseUrl(appUrl)}${suffix}`;
}

export function emailBodyWithLink(message: string, path: string, appUrl?: string) {
  return `${message}\n\nOpen: ${absolutePortalUrl(path, appUrl)}`;
}

function pushUniqueEmail(
  out: FamilyEmailRecipient[],
  seen: Set<string>,
  email: string | null | undefined,
  audience: "student" | "parent"
) {
  const trimmed = email?.trim();
  if (!trimmed || !trimmed.includes("@")) return;
  const key = trimmed.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ email: trimmed, audience });
}

export function familyEmailsFrom(student: FamilyEmailSource): FamilyEmailRecipient[] {
  const seen = new Set<string>();
  const out: FamilyEmailRecipient[] = [];
  pushUniqueEmail(out, seen, student.user?.email, "student");
  pushUniqueEmail(out, seen, student.email, "student");
  for (const link of student.guardians ?? []) {
    pushUniqueEmail(out, seen, link.guardian.user?.email, "parent");
    pushUniqueEmail(out, seen, link.guardian.email, "parent");
  }
  return out;
}

const familyEmailSelect = {
  userId: true,
  email: true,
  user: { select: { email: true } },
  guardians: {
    select: {
      guardian: {
        select: {
          email: true,
          user: { select: { email: true } },
        },
      },
    },
  },
} as const;

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

async function emailFamily(opts: {
  schoolId: string;
  recipients: FamilyEmailRecipient[];
  title: string;
  studentMessage: string;
  parentMessage: string;
  studentLink: string;
  parentLink: string;
}) {
  await Promise.all(
    opts.recipients.map((recipient) =>
      sendOutboundMessage(
        opts.schoolId,
        "email",
        recipient.email,
        opts.title,
        emailBodyWithLink(
          recipient.audience === "student" ? opts.studentMessage : opts.parentMessage,
          recipient.audience === "student" ? opts.studentLink : opts.parentLink
        )
      )
    )
  );
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
      select: familyEmailSelect,
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
  if (student) {
    await emailFamily({
      schoolId: opts.schoolId,
      recipients: familyEmailsFrom(student),
      title: notice.title,
      studentMessage: notice.studentMessage,
      parentMessage: notice.parentMessage,
      studentLink: notice.studentLink,
      parentLink: notice.parentLink,
    });
  }
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

  const notice = DOCUMENTS_RELEASED_NOTICE;
  if (opts.studentUserId) {
    await notifyUser({
      userId: opts.studentUserId,
      schoolId: opts.schoolId,
      title: notice.title,
      message: notice.message,
      type: "ACADEMIC",
      link: notice.studentLink,
    });
  }
  await notifyStudentGuardians({
    studentId: opts.studentId,
    schoolId: opts.schoolId,
    title: notice.title,
    message: notice.message,
    type: "ACADEMIC",
    link: notice.parentLink,
  });

  const student = await prisma.student.findUnique({
    where: { id: opts.studentId },
    select: familyEmailSelect,
  });
  if (student) {
    await emailFamily({
      schoolId: opts.schoolId,
      recipients: familyEmailsFrom(student),
      title: notice.title,
      studentMessage: notice.message,
      parentMessage: notice.message,
      studentLink: notice.studentLink,
      parentLink: notice.parentLink,
    });
  }
  return true;
}
