import { prisma } from "@/lib/db";
import { formatDurationMinutes, minutesBetweenHHMM, zonedParts } from "./engine";
import { gateDayRange, dayBoundaryForSchool, gateEventsForDay, listMissingCheckouts, listOnSitePeople, presentEvent, todayKey } from "./queries";

export const GATE_REPORT_TYPES = [
  "register",
  "arrivals",
  "late",
  "early",
  "staff",
  "visitors",
  "onsite",
  "activity",
  "manual",
  "denied",
  "missing",
] as const;

export type GateReportType = (typeof GATE_REPORT_TYPES)[number];

export function isGateReportType(value: string | null | undefined): value is GateReportType {
  return (GATE_REPORT_TYPES as readonly string[]).includes(value ?? "");
}

export const GATE_REPORT_LABELS: Record<GateReportType, string> = {
  register: "Daily gate register",
  arrivals: "Learner arrivals",
  late: "Late learners",
  early: "Early departures",
  staff: "Staff time in / time out",
  visitors: "Visitor register",
  onsite: "People currently on site",
  activity: "Gate activity by date",
  manual: "Manual overrides",
  denied: "Denied and failed scans",
  missing: "Missing checkouts",
};

export async function getGateReport(schoolId: string, type: GateReportType, dateKey = todayKey()) {
  if (type === "onsite") {
    const live = await listOnSitePeople(schoolId);
    const rows = [
      ...live.people.map((person) => [person.personType, person.displayName, person.number ?? "", person.detailLine ?? "", zonedParts(new Date(person.since)).hhmm]),
      ...live.visitors.map((visitor) => ["VISITOR", `${visitor.firstName} ${visitor.lastName}`, visitor.referenceNumber ?? "", visitor.hostName, zonedParts(new Date(visitor.signedInAt)).hhmm]),
    ];
    return {
      title: GATE_REPORT_LABELS.onsite,
      columns: ["Type", "Name", "Number", "Detail", "Since"],
      rows,
    };
  }

  if (type === "visitors") {
    const range = gateDayRange(dateKey);
    const entries = await prisma.visitorEntry.findMany({
      where: {
        schoolId,
        OR: [
          { signedInAt: { gte: range.start, lte: range.end } },
          { expectedAt: { gte: range.start, lte: range.end } },
        ],
      },
      orderBy: { signedInAt: "desc" },
      take: 1000,
      select: {
        referenceNumber: true,
        firstName: true,
        lastName: true,
        organisation: true,
        hostName: true,
        purpose: true,
        status: true,
        vehicleRegistration: true,
        signedInAt: true,
        signedOutAt: true,
      },
    });
    return {
      title: GATE_REPORT_LABELS.visitors,
      columns: ["Reference", "Visitor", "Organisation", "Host", "Purpose", "Status", "Vehicle", "In", "Out"],
      rows: entries.map((row) => [
        row.referenceNumber ?? "",
        `${row.firstName} ${row.lastName}`,
        row.organisation ?? "",
        row.hostName,
        row.purpose,
        row.status,
        row.vehicleRegistration ?? "",
        zonedParts(row.signedInAt).hhmm,
        row.signedOutAt ? zonedParts(row.signedOutAt).hhmm : "",
      ]),
    };
  }

  if (type === "missing") {
    const missing = await listMissingCheckouts(schoolId);
    return {
      title: GATE_REPORT_LABELS.missing,
      columns: ["Name", "Detail", "Since", "Status"],
      rows: missing.rows.map((row) => [row.name, row.detail, zonedParts(new Date(row.since)).hhmm, row.label]),
    };
  }

  if (type === "staff") {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    const boundary = await dayBoundaryForSchool(schoolId);
    const nowClock = zonedParts(new Date());
    const dayClosed = dateKey < nowClock.dateKey || (dateKey === nowClock.dateKey && nowClock.hhmm >= boundary);
    const records = await prisma.staffAttendanceRecord.findMany({
      where: { schoolId, date, checkIn: { not: null } },
      orderBy: { checkIn: "asc" },
      take: 1000,
      select: {
        checkIn: true,
        checkOut: true,
        status: true,
        source: true,
        user: { select: { firstName: true, lastName: true } },
        employee: { select: { firstName: true, lastName: true, employeeNumber: true, position: true, department: true } },
      },
    });
    return {
      title: GATE_REPORT_LABELS.staff,
      columns: ["Name", "Number", "Role", "In", "Out", "Time on site", "Status", "Source"],
      rows: records.map((row) => {
        const mins = row.checkIn && row.checkOut ? minutesBetweenHHMM(row.checkIn, row.checkOut) : null;
        const name = row.user
          ? `${row.user.firstName} ${row.user.lastName}`
          : row.employee
            ? `${row.employee.firstName} ${row.employee.lastName}`
            : "Staff member";
        return [
          name,
          row.employee?.employeeNumber ?? "",
          row.employee?.position ?? row.employee?.department ?? "",
          row.checkIn ?? "",
          row.checkOut ?? "",
          mins == null ? (dayClosed && !row.checkOut ? "Missing checkout" : "") : formatDurationMinutes(mins),
          row.status,
          row.source,
        ];
      }),
    };
  }

  const events = await gateEventsForDay(schoolId, dateKey, reportFilter(type));
  const presented = events.map(presentEvent);
  return {
    title: GATE_REPORT_LABELS[type],
    columns: ["Time", "Name", "Number", "Detail", "Direction", "Method", "Result", "Recorded by"],
    rows: presented.map((row) => [
      row.time,
      row.name,
      row.number,
      row.detail,
      row.direction,
      row.method,
      row.outcome === "RECORDED" ? row.punctuality ?? "RECORDED" : row.denialCode ?? row.outcome,
      row.recordedBy,
    ]),
  };
}

function reportFilter(type: GateReportType): Record<string, unknown> | undefined {
  if (type === "register") return { outcome: { in: ["RECORDED", "EARLY_DEPARTURE"] } };
  if (type === "arrivals") return { personType: "STUDENT", direction: "IN", outcome: "RECORDED" };
  if (type === "late") return { personType: "STUDENT", direction: "IN", punctuality: "LATE", outcome: "RECORDED" };
  if (type === "early") return { outcome: "EARLY_DEPARTURE" };
  if (type === "manual") return { method: "MANUAL" };
  if (type === "denied") return { outcome: { in: ["DENIED", "DUPLICATE"] } };
  return undefined;
}

