import { UserRole } from "@prisma/client";
import { prisma } from "./db";
import { getSchoolFilter, requirePermission, type Permission } from "./rbac";
import type { SessionPayload } from "./session";
import { invoiceBasePathForRole } from "./portal-paths";
import { canAccessAdmin } from "./rbac";

export type SearchResultKind = "learner" | "invoice" | "application" | "staff";

export type SearchResult = {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const MIN_QUERY = 2;
const LIMIT_PER_KIND = 5;

function schoolWhere(session: SessionPayload) {
  return getSchoolFilter(session);
}

function can(session: SessionPayload, permission: Permission): boolean {
  return requirePermission(session, permission);
}

export async function runGlobalSearch(
  session: SessionPayload,
  rawQuery: string
): Promise<SearchResult[]> {
  const q = rawQuery.trim();
  if (q.length < MIN_QUERY) return [];

  const filter = schoolWhere(session);
  const results: SearchResult[] = [];
  const invoiceBase = invoiceBasePathForRole(session.role);
  const adminApps = canAccessAdmin(session.role);

  const tasks: Array<Promise<void>> = [];

  if (can(session, "students:read")) {
    tasks.push(
      (async () => {
        const students = await prisma.student.findMany({
          where: {
            ...filter,
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { studentNumber: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentNumber: true,
            grade: { select: { name: true } },
          },
          take: LIMIT_PER_KIND,
          orderBy: { lastName: "asc" },
        });
        for (const s of students) {
          const href =
            session.role === UserRole.PARENT
              ? `/parent/children`
              : session.role === UserRole.TEACHER
                ? `/teacher/classes`
                : canAccessAdmin(session.role) || session.role === UserRole.FINANCE_OFFICER
                  ? canAccessAdmin(session.role)
                    ? `/admin/students/${s.id}`
                    : `/finance/student-accounts?studentId=${s.id}`
                  : `/admin/students/${s.id}`;
          results.push({
            kind: "learner",
            id: s.id,
            title: `${s.firstName} ${s.lastName}`,
            subtitle: [s.studentNumber, s.grade?.name].filter(Boolean).join(" · "),
            href,
          });
        }
      })()
    );
  }

  if (can(session, "finance:read") || can(session, "finance.view")) {
    tasks.push(
      (async () => {
        const invoices = await prisma.invoice.findMany({
          where: {
            ...filter,
            OR: [
              { invoiceNumber: { contains: q, mode: "insensitive" } },
              {
                student: {
                  OR: [
                    { firstName: { contains: q, mode: "insensitive" } },
                    { lastName: { contains: q, mode: "insensitive" } },
                    { studentNumber: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            ],
          },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            student: { select: { firstName: true, lastName: true } },
          },
          take: LIMIT_PER_KIND,
          orderBy: { issuedAt: "desc" },
        });
        for (const inv of invoices) {
          results.push({
            kind: "invoice",
            id: inv.id,
            title: inv.invoiceNumber,
            subtitle: `${inv.student.firstName} ${inv.student.lastName} · ${inv.status}`,
            href: `${invoiceBase}/${inv.id}`,
          });
        }
      })()
    );
  }

  if (adminApps && can(session, "students:read")) {
    tasks.push(
      (async () => {
        const apps = await prisma.application.findMany({
          where: {
            ...filter,
            OR: [
              { referenceNo: { contains: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            referenceNo: true,
            firstName: true,
            lastName: true,
            status: true,
          },
          take: LIMIT_PER_KIND,
          orderBy: { submittedAt: "desc" },
        });
        for (const app of apps) {
          results.push({
            kind: "application",
            id: app.id,
            title: `${app.firstName} ${app.lastName}`,
            subtitle: `${app.referenceNo} · ${app.status}`,
            href: `/admin/applications#${app.id}`,
          });
        }
      })()
    );
  }

  if (can(session, "staff:read")) {
    tasks.push(
      (async () => {
        const teachers = await prisma.teacher.findMany({
          where: {
            ...filter,
            OR: [
              { employeeNumber: { contains: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
          },
          take: LIMIT_PER_KIND,
          orderBy: { lastName: "asc" },
        });
        for (const t of teachers) {
          results.push({
            kind: "staff",
            id: t.id,
            title: `${t.firstName} ${t.lastName}`,
            subtitle: [t.employeeNumber, t.email].filter(Boolean).join(" · "),
            href: canAccessAdmin(session.role) ? "/admin/staff" : "/hr/staff",
          });
        }
      })()
    );
  }

  await Promise.all(tasks);

  const order: SearchResultKind[] = ["learner", "invoice", "application", "staff"];
  results.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return results.slice(0, 20);
}
