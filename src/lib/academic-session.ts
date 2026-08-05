import { cookies } from "next/headers";
import {
  AcademicPeriodStatus,
  AcademicSessionStatus,
  type AcademicYear,
  type Term,
} from "@prisma/client";
import { prisma } from "./db";

export const VIEW_SESSION_COOKIE = "schoolhub_academic_session";

export const SESSION_STATUS_LABELS: Record<AcademicSessionStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

export const PERIOD_STATUS_LABELS: Record<AcademicPeriodStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  CLOSED: "Closed",
};

export type SessionOption = Pick<
  AcademicYear,
  "id" | "name" | "status" | "isCurrent" | "startDate" | "endDate"
>;

export async function getViewSessionIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(VIEW_SESSION_COOKIE)?.value ?? null;
}

export async function listAcademicSessions(
  schoolId: string
): Promise<SessionOption[]> {
  return prisma.academicYear.findMany({
    where: { schoolId },
    select: {
      id: true,
      name: true,
      status: true,
      isCurrent: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "desc" },
  });
}

export async function resolveViewSession(
  schoolId: string,
  preferredId?: string | null
): Promise<SessionOption | null> {
  const sessions = await listAcademicSessions(schoolId);
  if (sessions.length === 0) return null;

  if (preferredId) {
    const match = sessions.find((s) => s.id === preferredId);
    if (match) return match;
  }

  return (
    sessions.find((s) => s.isCurrent || s.status === AcademicSessionStatus.ACTIVE) ??
    sessions[0]
  );
}

export async function setCurrentAcademicSession(
  schoolId: string,
  academicYearId: string
): Promise<AcademicYear> {
  return prisma.$transaction(async (tx) => {
    await tx.academicYear.updateMany({
      where: { schoolId, isCurrent: true },
      data: { isCurrent: false },
    });

    return tx.academicYear.update({
      where: { id: academicYearId },
      data: {
        isCurrent: true,
        status: AcademicSessionStatus.ACTIVE,
        closedAt: null,
        archivedAt: null,
      },
    });
  });
}

export async function setCurrentTerm(termId: string): Promise<Term> {
  const term = await prisma.term.findUnique({ where: { id: termId } });
  if (!term) throw new Error("Term not found");

  return prisma.$transaction(async (tx) => {
    await tx.term.updateMany({
      where: { academicYearId: term.academicYearId, isCurrent: true },
      data: { isCurrent: false, status: AcademicPeriodStatus.CLOSED },
    });

    return tx.term.update({
      where: { id: termId },
      data: {
        isCurrent: true,
        status: AcademicPeriodStatus.ACTIVE,
      },
    });
  });
}

export function parseDateInput(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
