import { GateEventOutcome, GatePersonType, UserRole, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toPublicVisitorEntry } from "@/lib/visitors";
import {
  normalizeCardToken,
  toStaffGatePerson,
  toStudentGatePerson,
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
  personKey: string;
  personType: string;
  studentId: string | null;
  userId: string | null;
  direction: string;
  scannedAt: Date;
};

export async function listOpenPresence(schoolId: string): Promise<PresenceRow[]> {
  const rows = await prisma.$queryRaw<PresenceRow[]>`
    SELECT DISTINCT ON ("personKey")
      "personKey",
      "personType"::text AS "personType",
      "studentId",
      "userId",
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

export async function occupancyCounts(schoolId: string) {
  const [open, visitors] = await Promise.all([
    listOpenPresence(schoolId),
    prisma.visitorEntry.count({
      where: { schoolId, signedOutAt: null, status: { in: ["CHECKED_IN", "OVERDUE"] } },
    }),
  ]);
  return {
    learners: open.filter((row) => row.personType === "STUDENT").length,
    staff: open.filter((row) => row.personType === "STAFF").length,
    visitors,
  };
}

export async function listOnSitePeople(schoolId: string, query?: string) {
  const open = await listOpenPresence(schoolId);
  const studentIds = open.map((row) => row.studentId).filter((id): id is string => Boolean(id));
  const userIds = open.map((row) => row.userId).filter((id): id is string => Boolean(id));
  const [students, users, visitors] = await Promise.all([
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
    prisma.visitorEntry.findMany({
      where: { schoolId, signedOutAt: null, status: { in: ["CHECKED_IN", "OVERDUE"] } },
      include: {
        campus: { select: { name: true } },
        signedInBy: { select: { firstName: true, lastName: true } },
        signedOutBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { signedInAt: "desc" },
      take: 200,
    }),
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
    if (row.personType === "STAFF" && row.userId) {
      const user = users.find((item) => item.id === row.userId);
      if (!user) continue;
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
  const filteredPeople = needle
    ? people.filter((person) => `${person.displayName} ${person.number ?? ""} ${person.detailLine ?? ""}`.toLowerCase().includes(needle))
    : people;
  const visitorRows = visitors
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
      select: { studentId: true, userId: true },
    });
    if (card?.studentId) {
      const student = await prisma.student.findFirst({
        where: { id: card.studentId, schoolId },
        select: studentSearchSelect,
      });
      if (student) people.push(studentToPerson(student));
    }
    if (card?.userId) {
      const user = await prisma.user.findFirst({
        where: { id: card.userId, schoolId },
        select: staffSearchSelect,
      });
      if (user) people.push(staffToPerson(user));
    }
    if (people.length) return people;
  }

  const [students, users] = await Promise.all([
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
  ]);
  return [...students.map(studentToPerson), ...users.map(staffToPerson)];
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
  visitorEntry: { select: { firstName: true, lastName: true, referenceNumber: true } },
  recordedBy: { select: { firstName: true, lastName: true } },
  gate: { select: { name: true } },
} satisfies Prisma.GateEventSelect;

export type GateEventRow = Prisma.GateEventGetPayload<{ select: typeof eventSelect }>;

export function presentEvent(row: GateEventRow) {
  const name = row.student
    ? `${row.student.firstName} ${row.student.lastName}`
    : row.staffUser
      ? `${row.staffUser.firstName} ${row.staffUser.lastName}`
      : row.visitorEntry
        ? `${row.visitorEntry.firstName} ${row.visitorEntry.lastName}`
        : "Unknown card";
  const number = row.student?.studentNumber ?? row.staffUser?.employee?.employeeNumber ?? row.staffUser?.teacher?.employeeNumber ?? row.visitorEntry?.referenceNumber ?? "";
  const detail = row.student
    ? [row.student.grade?.name, row.student.class?.name].filter(Boolean).join(" ")
    : row.staffUser?.employee?.position ?? "";
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

export async function dashboardSnapshot(schoolId: string, now = new Date()) {
  const dateKey = todayKey(now);
  const range = gateDayRange(dateKey);
  const [counts, late, early, waiting, recent, gates] = await Promise.all([
    occupancyCounts(schoolId),
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
    prisma.visitorEntry.count({
      where: { schoolId, signedOutAt: null, status: { in: ["CHECKED_IN", "OVERDUE"] } },
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
    visitorsAwaitingCheckout: waiting,
    recent: recent.map(presentEvent),
    gates,
  };
}
