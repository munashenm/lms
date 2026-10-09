import { GateEventOutcome, GatePersonType, UserRole, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toPublicVisitorEntry } from "@/lib/visitors";
import {
  DEFAULT_DAY_BOUNDARY,
  normalizeCardToken,
  openPresenceState,
  toStaffGatePerson,
  toStudentGatePerson,
  validHHMM,
  zonedParts,
  type GatePerson,
} from "./engine";

const STAFF_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.STAFF,
  UserRole.SECURITY,
  UserRole.FINANCE_OFFICER,
  UserRole.HR_OFFICER,
  UserRole.ADMISSIONS_OFFICER,
  UserRole.PRINCIPAL,
  UserRole.SCHOOL_ADMIN,
];

export function gateDayRange(dateKey: string) {
  return {
    start: new Date(`${dateKey}T00:00:00.000+02:00`),
    end: new Date(`${dateKey}T23:59:59.999+02:00`),
  };
}

export function todayKey(now = new Date()): string {
  return zonedParts(now).dateKey;
}

type PresenceRow = {
  id: string;
  personKey: string;
  personType: string;
  studentId: string | null;
  userId: string | null;
  employeeId: string | null;
  direction: string;
  scannedAt: Date;
};

export async function listOpenPresence(schoolId: string): Promise<PresenceRow[]> {
  const rows = await prisma.$queryRaw<PresenceRow[]>`
    SELECT DISTINCT ON ("personKey")
      id,
      "personKey",
      "personType"::text AS "personType",
      "studentId",
      "userId",
      "employeeId",
      direction::text AS direction,
      "scannedAt"
    FROM gate_events
    WHERE "schoolId" = ${schoolId}
      AND outcome::text IN ('RECORDED', 'EARLY_DEPARTURE')
      AND "personType"::text IN ('STUDENT', 'STAFF')
    ORDER BY "personKey", "scannedAt" DESC
  `;
  return rows.filter((row) => row.direction === "IN");
}

export async function dayBoundaryForSchool(schoolId: string): Promise<string> {
  const policy = await prisma.gatePolicy.findUnique({
    where: { schoolId },
    select: { dayBoundaryTime: true },
  });
  return validHHMM(policy?.dayBoundaryTime) ?? DEFAULT_DAY_BOUNDARY;
}

export async function splitOpenPresence(schoolId: string, now = new Date()) {
  const [open, boundary, reconciled] = await Promise.all([
    listOpenPresence(schoolId),
    dayBoundaryForSchool(schoolId),
    prisma.gateCheckoutReconciliation.findMany({
      where: { schoolId },
      select: { gateEventId: true, visitorEntryId: true },
    }),
  ]);
  const reconciledEvents = new Set(reconciled.map((row) => row.gateEventId).filter((id): id is string => Boolean(id)));
  const reconciledVisitors = new Set(reconciled.map((row) => row.visitorEntryId).filter((id): id is string => Boolean(id)));
  const onSite = open.filter((row) => !reconciledEvents.has(row.id) && openPresenceState({ scannedAt: row.scannedAt, now, dayBoundary: boundary }) === "on_site");
  const missing = open.filter((row) => !reconciledEvents.has(row.id) && openPresenceState({ scannedAt: row.scannedAt, now, dayBoundary: boundary }) === "missing_out");
  return { onSite, missing, boundary, reconciledVisitors };
}

async function checkedInVisitors(schoolId: string) {
  return prisma.visitorEntry.findMany({
    where: { schoolId, signedOutAt: null, status: { in: ["CHECKED_IN", "OVERDUE"] } },
    include: {
      campus: { select: { name: true } },
      signedInBy: { select: { firstName: true, lastName: true } },
      signedOutBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { signedInAt: "desc" },
    take: 500,
  });
}

export async function openVisitors(
  schoolId: string,
  now = new Date(),
  presence?: Awaited<ReturnType<typeof splitOpenPresence>>
) {
  const [rows, boundary, resolved] = await Promise.all([
    checkedInVisitors(schoolId),
    dayBoundaryForSchool(schoolId),
    presence ?? splitOpenPresence(schoolId, now),
  ]);
  const reconciledVisitors = resolved.reconciledVisitors;
  const onSite = rows.filter(
    (row) =>
      !reconciledVisitors.has(row.id) &&
      openPresenceState({ scannedAt: row.signedInAt, now, dayBoundary: boundary }) === "on_site"
  );
  const missing = rows.filter(
    (row) =>
      !reconciledVisitors.has(row.id) &&
      openPresenceState({ scannedAt: row.signedInAt, now, dayBoundary: boundary }) === "missing_out"
  );
  return { onSite, missing, boundary };
}

export async function occupancyCounts(schoolId: string, now = new Date()) {
  const presence = await splitOpenPresence(schoolId, now);
  const visitors = await openVisitors(schoolId, now, presence);
  return {
    learners: presence.onSite.filter((row) => row.personType === "STUDENT").length,
    staff: presence.onSite.filter((row) => row.personType === "STAFF").length,
    visitors: visitors.onSite.length,
    missingCheckouts: presence.missing.length + visitors.missing.length,
  };
}

export async function listOnSitePeople(schoolId: string, query?: string, now = new Date()) {
  const presence = await splitOpenPresence(schoolId, now);
  const visitorSplit = await openVisitors(schoolId, now, presence);
  const open = presence.onSite;
  const studentIds = open.map((row) => row.studentId).filter((id): id is string => Boolean(id));
  const userIds = open.map((row) => row.userId).filter((id): id is string => Boolean(id));
  const employeeIds = open.map((row) => row.employeeId).filter((id): id is string => Boolean(id));
  const [students, users, employees] = await Promise.all([
    studentIds.length
      ? prisma.student.findMany({
          where: { schoolId, id: { in: studentIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentNumber: true,
            photoUrl: true,
            status: true,
            classId: true,
            userId: true,
            grade: { select: { name: true } },
            class: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({
          where: { schoolId, id: { in: userIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            isActive: true,
            avatarUrl: true,
            teacher: { select: { employeeNumber: true, department: true } },
            employee: { select: { id: true, employeeNumber: true, department: true, position: true, status: true } },
          },
        })
      : Promise.resolve([]),
    employeeIds.length
      ? prisma.employee.findMany({
          where: { schoolId, id: { in: employeeIds } },
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            department: true,
            position: true,
            status: true,
            user: { select: { isActive: true, avatarUrl: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const needle = query?.trim().toLowerCase() ?? "";
  const people: Array<GatePerson & { since: string }> = [];
  for (const row of open) {
    if (row.personType === "STUDENT" && row.studentId) {
      const student = students.find((item) => item.id === row.studentId);
      if (!student) continue;
      const person = toStudentGatePerson({
        ...student,
        gradeName: student.grade?.name ?? null,
        className: student.class?.name ?? null,
      });
      people.push({ ...person, since: new Date(row.scannedAt).toISOString() });
    }
    if (row.personType === "STAFF") {
      const employee = row.employeeId ? employees.find((item) => item.id === row.employeeId) : undefined;
      const user = !employee && row.userId ? users.find((item) => item.id === row.userId) : undefined;
      if (employee) {
        const person = toStaffGatePerson({
          userId: employee.userId,
          firstName: employee.firstName,
          lastName: employee.lastName,
          isActive: employee.user?.isActive ?? true,
          employeeNumber: employee.employeeNumber,
          department: employee.department,
          position: employee.position,
          employeeStatus: employee.status,
          employeeId: employee.id,
          photoUrl: employee.user?.avatarUrl ?? null,
        });
        people.push({ ...person, since: new Date(row.scannedAt).toISOString() });
      } else if (user) {
        const person = toStaffGatePerson({
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
          employeeNumber: user.employee?.employeeNumber ?? user.teacher?.employeeNumber ?? null,
          department: user.employee?.department ?? user.teacher?.department ?? null,
          position: user.employee?.position ?? null,
          employeeStatus: user.employee?.status ?? null,
          employeeId: user.employee?.id ?? null,
          photoUrl: user.avatarUrl,
        });
        people.push({ ...person, since: new Date(row.scannedAt).toISOString() });
      }
    }
  }
  const filteredPeople = needle
    ? people.filter((person) => `${person.displayName} ${person.number ?? ""} ${person.detailLine ?? ""}`.toLowerCase().includes(needle))
    : people;
  const visitorRows = visitorSplit.onSite
    .map(toPublicVisitorEntry)
    .filter((row) => !needle || `${row.firstName} ${row.lastName} ${row.referenceNumber ?? ""} ${row.hostName}`.toLowerCase().includes(needle));
  return { people: filteredPeople, visitors: visitorRows };
}

export async function searchGatePeople(schoolId: string, query: string): Promise<GatePerson[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const token = normalizeCardToken(q);
  const people: GatePerson[] = [];
  if (token) {
    const card = await prisma.accessCard.findFirst({
      where: { schoolId, token, status: "ACTIVE" },
      select: { studentId: true, userId: true, employeeId: true },
    });
    if (card?.studentId) {
      const student = await prisma.student.findFirst({
        where: { id: card.studentId, schoolId },
        select: studentSearchSelect,
      });
      if (student) people.push(studentToPerson(student));
    }
    if (card?.employeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: card.employeeId, schoolId },
        select: employeeSearchSelect,
      });
      if (employee) people.push(employeeToPerson(employee));
    } else if (card?.userId) {
      const user = await prisma.user.findFirst({
        where: { id: card.userId, schoolId },
        select: staffSearchSelect,
      });
      if (user) people.push(staffToPerson(user));
    }
    if (people.length) return people;
  }

  const [students, users, employees] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { studentNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      select: studentSearchSelect,
      take: 12,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.user.findMany({
      where: {
        schoolId,
        role: { in: STAFF_ROLES },
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { teacher: { employeeNumber: { equals: q, mode: "insensitive" } } },
          { employee: { employeeNumber: { equals: q, mode: "insensitive" } } },
        ],
      },
      select: staffSearchSelect,
      take: 12,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.employee.findMany({
      where: {
        schoolId,
        status: { not: "TERMINATED" },
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { employeeNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      select: employeeSearchSelect,
      take: 12,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);
  const linkedUserIds = new Set(employees.map((employee) => employee.userId).filter((id): id is string => Boolean(id)));
  return [
    ...students.map(studentToPerson),
    ...employees.map(employeeToPerson),
    ...users.filter((user) => !linkedUserIds.has(user.id)).map(staffToPerson),
  ];
}

const studentSearchSelect = {
  id: true,
  firstName: true,
  lastName: true,
  studentNumber: true,
  photoUrl: true,
  status: true,
  classId: true,
  userId: true,
  grade: { select: { name: true } },
  class: { select: { name: true } },
} satisfies Prisma.StudentSelect;

const employeeSearchSelect = {
  id: true,
  userId: true,
  firstName: true,
  lastName: true,
  employeeNumber: true,
  department: true,
  position: true,
  status: true,
  user: { select: { isActive: true, avatarUrl: true } },
} satisfies Prisma.EmployeeSelect;

const staffSearchSelect = {
  id: true,
  firstName: true,
  lastName: true,
  isActive: true,
  avatarUrl: true,
  teacher: { select: { employeeNumber: true, department: true } },
  employee: { select: { id: true, employeeNumber: true, department: true, position: true, status: true } },
} satisfies Prisma.UserSelect;

function studentToPerson(student: {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  photoUrl: string | null;
  status: string;
  classId: string | null;
  userId: string | null;
  grade: { name: string } | null;
  class: { name: string } | null;
}): GatePerson {
  return toStudentGatePerson({
    ...student,
    gradeName: student.grade?.name ?? null,
    className: student.class?.name ?? null,
  });
}

function employeeToPerson(employee: {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  department: string | null;
  position: string | null;
  status: string;
  user: { isActive: boolean; avatarUrl: string | null } | null;
}): GatePerson {
  return toStaffGatePerson({
    userId: employee.userId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    isActive: employee.user?.isActive ?? true,
    employeeNumber: employee.employeeNumber,
    department: employee.department,
    position: employee.position,
    employeeStatus: employee.status,
    employeeId: employee.id,
    photoUrl: employee.user?.avatarUrl ?? null,
  });
}

function staffToPerson(user: {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  avatarUrl: string | null;
  teacher: { employeeNumber: string; department: string | null } | null;
  employee: { id: string; employeeNumber: string; department: string | null; position: string | null; status: string } | null;
}): GatePerson {
  return toStaffGatePerson({
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    employeeNumber: user.employee?.employeeNumber ?? user.teacher?.employeeNumber ?? null,
    department: user.employee?.department ?? user.teacher?.department ?? null,
    position: user.employee?.position ?? null,
    employeeStatus: user.employee?.status ?? null,
    employeeId: user.employee?.id ?? null,
    photoUrl: user.avatarUrl,
  });
}

export async function recentGateEvents(schoolId: string, take = 12) {
  return prisma.gateEvent.findMany({
    where: { schoolId },
    orderBy: { scannedAt: "desc" },
    take,
    select: eventSelect,
  });
}

export async function gateEventsForDay(schoolId: string, dateKey: string, where?: Prisma.GateEventWhereInput) {
  const range = gateDayRange(dateKey);
  return prisma.gateEvent.findMany({
    where: {
      schoolId,
      scannedAt: { gte: range.start, lte: range.end },
      ...where,
    },
    orderBy: { scannedAt: "desc" },
    take: 1000,
    select: eventSelect,
  });
}

const eventSelect = {
  id: true,
  personType: true,
  direction: true,
  method: true,
  outcome: true,
  punctuality: true,
  denialCode: true,
  scannedAt: true,
  notes: true,
  manualReason: true,
  earlyDepartureReason: true,
  student: { select: { firstName: true, lastName: true, studentNumber: true, grade: { select: { name: true } }, class: { select: { name: true } } } },
  staffUser: { select: { firstName: true, lastName: true, employee: { select: { employeeNumber: true, position: true } }, teacher: { select: { employeeNumber: true } } } },
  employee: { select: { firstName: true, lastName: true, employeeNumber: true, position: true } },
  visitorEntry: { select: { firstName: true, lastName: true, referenceNumber: true } },
  recordedBy: { select: { firstName: true, lastName: true } },
  gate: { select: { name: true } },
} satisfies Prisma.GateEventSelect;

export type GateEventRow = Prisma.GateEventGetPayload<{ select: typeof eventSelect }>;

export function presentEvent(row: GateEventRow) {
  const name = row.student
    ? `${row.student.firstName} ${row.student.lastName}`
    : row.employee
      ? `${row.employee.firstName} ${row.employee.lastName}`
      : row.staffUser
        ? `${row.staffUser.firstName} ${row.staffUser.lastName}`
        : row.visitorEntry
          ? `${row.visitorEntry.firstName} ${row.visitorEntry.lastName}`
          : "Unknown card";
  const number = row.student?.studentNumber ?? row.employee?.employeeNumber ?? row.staffUser?.employee?.employeeNumber ?? row.staffUser?.teacher?.employeeNumber ?? row.visitorEntry?.referenceNumber ?? "";
  const detail = row.student
    ? [row.student.grade?.name, row.student.class?.name].filter(Boolean).join(" ")
    : row.employee?.position ?? row.staffUser?.employee?.position ?? "";
  return {
    id: row.id,
    name,
    number,
    detail,
    personType: row.personType,
    direction: row.direction,
    method: row.method,
    outcome: row.outcome,
    punctuality: row.punctuality,
    denialCode: row.denialCode,
    scannedAt: row.scannedAt.toISOString(),
    time: zonedParts(row.scannedAt).hhmm,
    manualReason: row.manualReason,
    earlyDepartureReason: row.earlyDepartureReason,
    recordedBy: `${row.recordedBy.firstName} ${row.recordedBy.lastName}`,
    gate: row.gate?.name ?? null,
    notes: row.notes,
  };
}

export async function listMissingCheckouts(schoolId: string, now = new Date()) {
  const presence = await splitOpenPresence(schoolId, now);
  const visitors = await openVisitors(schoolId, now, presence);
  const studentIds = presence.missing.map((row) => row.studentId).filter((id): id is string => Boolean(id));
  const employeeIds = presence.missing.map((row) => row.employeeId).filter((id): id is string => Boolean(id));
  const userIds = presence.missing.map((row) => row.userId).filter((id): id is string => Boolean(id));
  const [students, employees, users] = await Promise.all([
    studentIds.length
      ? prisma.student.findMany({ where: { schoolId, id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true, studentNumber: true } })
      : Promise.resolve([]),
    employeeIds.length
      ? prisma.employee.findMany({ where: { schoolId, id: { in: employeeIds } }, select: { id: true, firstName: true, lastName: true, employeeNumber: true, position: true } })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({ where: { schoolId, id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
      : Promise.resolve([]),
  ]);
  const rows: Array<{ kind: "gate" | "visitor"; id: string; name: string; detail: string; since: string; label: string }> = presence.missing.map((row) => {
    const student = students.find((item) => item.id === row.studentId);
    const employee = employees.find((item) => item.id === row.employeeId);
    const user = users.find((item) => item.id === row.userId);
    const name = student
      ? `${student.firstName} ${student.lastName}`
      : employee
        ? `${employee.firstName} ${employee.lastName}`
        : user
          ? `${user.firstName} ${user.lastName}`
          : "Unknown person";
    return {
      kind: "gate" as const,
      id: row.id,
      name,
      detail: student?.studentNumber ?? employee?.employeeNumber ?? employee?.position ?? row.personType,
      since: row.scannedAt.toISOString(),
      label: "Missing checkout",
    };
  });
  for (const visitor of visitors.missing) {
    rows.push({
      kind: "visitor",
      id: visitor.id,
      name: `${visitor.firstName} ${visitor.lastName}`,
      detail: visitor.referenceNumber ?? "Visitor",
      since: visitor.signedInAt.toISOString(),
      label: "Missing checkout",
    });
  }
  return { boundary: presence.boundary, rows };
}

export async function dashboardSnapshot(schoolId: string, now = new Date()) {
  const dateKey = todayKey(now);
  const range = gateDayRange(dateKey);
  const [counts, late, early, recent, gates] = await Promise.all([
    occupancyCounts(schoolId, now),
    prisma.gateEvent.count({
      where: {
        schoolId,
        personType: GatePersonType.STUDENT,
        direction: "IN",
        outcome: GateEventOutcome.RECORDED,
        punctuality: "LATE",
        scannedAt: { gte: range.start, lte: range.end },
      },
    }),
    prisma.gateEvent.count({
      where: {
        schoolId,
        outcome: GateEventOutcome.EARLY_DEPARTURE,
        scannedAt: { gte: range.start, lte: range.end },
      },
    }),
    recentGateEvents(schoolId, 8),
    prisma.gateCheckpoint.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    dateKey,
    time: zonedParts(now).hhmm,
    counts,
    lateArrivals: late,
    earlyDepartures: early,
    visitorsAwaitingCheckout: counts.visitors,
    missingCheckouts: counts.missingCheckouts,
    recent: recent.map(presentEvent),
    gates,
  };
}
