import crypto from "crypto";

/** Opaque card alphabet: Code 39 safe, no ambiguous characters, not derived from a person id. */
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const DEFAULT_SCHOOL_START = "07:30";
export const DEFAULT_DEPARTURE = "14:00";
export const DEFAULT_DAY_BOUNDARY = "18:00";
export const DEFAULT_DUPLICATE_SECONDS = 90;
export const DEFAULT_TIMEZONE = "Africa/Johannesburg";

export const EARLY_DEPARTURE_REASONS = [
  "PARENT_COLLECTION",
  "MEDICAL",
  "SCHOOL_ACTIVITY",
  "AUTHORIZED_LEAVE",
  "EMERGENCY",
  "OTHER",
] as const;

export type EarlyDepartureReasonCode = (typeof EARLY_DEPARTURE_REASONS)[number];

export const EARLY_DEPARTURE_REASON_LABELS: Record<EarlyDepartureReasonCode, string> = {
  PARENT_COLLECTION: "Parent/guardian collection",
  MEDICAL: "Medical",
  SCHOOL_ACTIVITY: "Approved school activity",
  AUTHORIZED_LEAVE: "Authorized leave",
  EMERGENCY: "Emergency",
  OTHER: "Other",
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const WEEKDAYS = {
  Mon: "MONDAY",
  Tue: "TUESDAY",
  Wed: "WEDNESDAY",
  Thu: "THURSDAY",
  Fri: "FRIDAY",
  Sat: "SATURDAY",
  Sun: "SUNDAY",
} as const;

export type WeekdayName = (typeof WEEKDAYS)[keyof typeof WEEKDAYS];

export type GateDirectionName = "IN" | "OUT";
export type GateMethodName = "QR" | "BARCODE" | "CAMERA" | "RFID" | "NFC" | "BIOMETRIC" | "MANUAL";
export type PersonKind = "STUDENT" | "STAFF";

export type ZonedClock = {
  year: number;
  month: number;
  day: number;
  hhmm: string;
  weekday: WeekdayName;
  dateKey: string;
  dateUtc: Date;
};

export function validHHMM(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return HHMM.test(trimmed) ? trimmed : null;
}

export function compareHHMM(a: string, b: string): number {
  return a.localeCompare(b);
}

export function addMinutesHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function minutesBetweenHHMM(start: string, end: string): number | null {
  if (!validHHMM(start) || !validHHMM(end) || compareHHMM(end, start) < 0) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function formatDurationMinutes(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function zonedParts(date: Date, timeZone = DEFAULT_TIMEZONE): ZonedClock {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  let hour = parts.hour ?? "00";
  if (hour === "24") hour = "00";
  const weekday = WEEKDAYS[(parts.weekday ?? "Mon") as keyof typeof WEEKDAYS] ?? "MONDAY";
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hhmm: `${hour}:${parts.minute}`,
    weekday,
    dateKey,
    dateUtc: new Date(`${dateKey}T00:00:00.000Z`),
  };
}

export function clampDuplicateInterval(seconds: number | null | undefined): number {
  if (!Number.isFinite(seconds)) return DEFAULT_DUPLICATE_SECONDS;
  return Math.min(3600, Math.max(10, Math.round(seconds as number)));
}

export type SavedGatePolicy = {
  schoolStartTime: string;
  lateAfterMinutes: number;
  normalDepartureTime: string;
  duplicateScanIntervalSeconds: number;
  dayBoundaryTime?: string;
};

export type SchoolDayWindow = {
  startTime: string;
  lateCutoff: string;
  departureTime: string;
  duplicateScanIntervalSeconds: number;
  source: "settings" | "timetable" | "default";
};

/**
 * Prefer an explicit gate policy. When the school has not saved one, use the
 * learner's timetable for that weekday, then the built-in school-day default.
 */
export function resolveSchoolDay(input: {
  saved: SavedGatePolicy | null;
  timetableStarts: string[];
  timetableEnds: string[];
}): SchoolDayWindow {
  const duplicateScanIntervalSeconds = clampDuplicateInterval(input.saved?.duplicateScanIntervalSeconds);
  if (input.saved) {
    const startTime = validHHMM(input.saved.schoolStartTime) ?? DEFAULT_SCHOOL_START;
    const departureTime = validHHMM(input.saved.normalDepartureTime) ?? DEFAULT_DEPARTURE;
    const grace = Number.isFinite(input.saved.lateAfterMinutes) ? Math.max(0, input.saved.lateAfterMinutes) : 0;
    return {
      startTime,
      lateCutoff: addMinutesHHMM(startTime, grace),
      departureTime,
      duplicateScanIntervalSeconds,
      source: "settings",
    };
  }
  const starts = input.timetableStarts.map((value) => validHHMM(value)).filter((value): value is string => Boolean(value)).sort();
  const ends = input.timetableEnds.map((value) => validHHMM(value)).filter((value): value is string => Boolean(value)).sort();
  if (starts.length > 0) {
    return {
      startTime: starts[0],
      lateCutoff: starts[0],
      departureTime: ends[ends.length - 1] ?? DEFAULT_DEPARTURE,
      duplicateScanIntervalSeconds,
      source: "timetable",
    };
  }
  return {
    startTime: DEFAULT_SCHOOL_START,
    lateCutoff: DEFAULT_SCHOOL_START,
    departureTime: DEFAULT_DEPARTURE,
    duplicateScanIntervalSeconds,
    source: "default",
  };
}

export function arrivalPunctuality(hhmm: string, lateCutoff: string): "ON_TIME" | "LATE" {
  return compareHHMM(hhmm, lateCutoff) > 0 ? "LATE" : "ON_TIME";
}

export function isEarlyDeparture(hhmm: string, departureTime: string): boolean {
  return compareHHMM(hhmm, departureTime) < 0;
}

export type CountingEvent = {
  id: string;
  direction: GateDirectionName;
  scannedAt: Date;
};

export type MovementDecision =
  | { kind: "duplicate"; outcome: "DUPLICATE"; denialCode: "ALREADY_IN" | "ALREADY_OUT"; duplicateOfId: string }
  | { kind: "already"; outcome: "DENIED"; denialCode: "ALREADY_IN" | "ALREADY_OUT" }
  | { kind: "not_on_site"; outcome: "DENIED"; denialCode: "NOT_ON_SITE" }
  | { kind: "need_reason"; outcome: "DENIED"; denialCode: "EARLY_DEPARTURE_REASON_REQUIRED" }
  | {
      kind: "record";
      outcome: "RECORDED" | "EARLY_DEPARTURE";
      punctuality: "ON_TIME" | "LATE" | "EARLY" | "NORMAL";
      earlyDepartureReason: EarlyDepartureReasonCode | null;
    };

export function decideMovement(input: {
  direction: GateDirectionName;
  now: Date;
  last: CountingEvent | null;
  duplicateIntervalSeconds: number;
  personType: PersonKind | "VISITOR";
  hhmm: string;
  lateCutoff: string;
  departureTime: string;
  earlyDepartureReason?: EarlyDepartureReasonCode | null;
  bypassDuplicate?: boolean;
}): MovementDecision {
  const last = input.last;
  if (last && last.direction === input.direction) {
    const delta = input.now.getTime() - new Date(last.scannedAt).getTime();
    const withinInterval = delta >= 0 && delta < input.duplicateIntervalSeconds * 1000;
    if (withinInterval && !input.bypassDuplicate) {
      return {
        kind: "duplicate",
        outcome: "DUPLICATE",
        denialCode: input.direction === "IN" ? "ALREADY_IN" : "ALREADY_OUT",
        duplicateOfId: last.id,
      };
    }
    return {
      kind: "already",
      outcome: "DENIED",
      denialCode: input.direction === "IN" ? "ALREADY_IN" : "ALREADY_OUT",
    };
  }
  if (input.direction === "OUT" && (!last || last.direction !== "IN")) {
    return { kind: "not_on_site", outcome: "DENIED", denialCode: "NOT_ON_SITE" };
  }
  if (
    input.direction === "OUT" &&
    input.personType === "STUDENT" &&
    isEarlyDeparture(input.hhmm, input.departureTime) &&
    !input.earlyDepartureReason
  ) {
    return { kind: "need_reason", outcome: "DENIED", denialCode: "EARLY_DEPARTURE_REASON_REQUIRED" };
  }
  if (input.direction === "IN") {
    return {
      kind: "record",
      outcome: "RECORDED",
      punctuality: arrivalPunctuality(input.hhmm, input.lateCutoff),
      earlyDepartureReason: null,
    };
  }
  const early = input.personType === "STUDENT" && isEarlyDeparture(input.hhmm, input.departureTime);
  return {
    kind: "record",
    outcome: early ? "EARLY_DEPARTURE" : "RECORDED",
    punctuality: early ? "EARLY" : "NORMAL",
    earlyDepartureReason: early ? input.earlyDepartureReason ?? null : null,
  };
}

/** Daily learner attendance only. Classroom/subject rows are never passed here. */
export function nextDailyAttendance(input: {
  existingStatus: string | null;
  direction: GateDirectionName;
  punctuality: "ON_TIME" | "LATE" | "EARLY" | "NORMAL";
}): { status: "PRESENT" | "LATE" | null; setArrival: boolean; setDeparture: boolean } {
  if (input.direction === "OUT") {
    return { status: null, setArrival: false, setDeparture: true };
  }
  if (input.existingStatus === "SICK" || input.existingStatus === "EXCUSED") {
    return { status: null, setArrival: true, setDeparture: false };
  }
  if (input.existingStatus === "LATE") {
    return { status: "LATE", setArrival: true, setDeparture: false };
  }
  return {
    status: input.punctuality === "LATE" ? "LATE" : "PRESENT",
    setArrival: true,
    setDeparture: false,
  };
}

export function nextStaffAttendance(input: {
  existing: { status: string; checkIn: string | null; checkOut: string | null } | null;
  direction: GateDirectionName;
  hhmm: string;
  punctuality: "ON_TIME" | "LATE" | "EARLY" | "NORMAL";
}): {
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  timeOnSite: string | null;
} {
  const existing = input.existing;
  if (input.direction === "IN") {
    let status = input.punctuality === "LATE" ? "LATE" : "PRESENT";
    if (existing?.status === "ON_LEAVE" || existing?.status === "REMOTE" || existing?.status === "LATE") {
      status = existing.status === "LATE" && input.punctuality === "ON_TIME" ? "LATE" : existing.status === "LATE" ? "LATE" : existing.status;
      if (existing.status === "LATE") status = "LATE";
      else if (existing.status === "ON_LEAVE" || existing.status === "REMOTE") status = existing.status;
    }
    return {
      status,
      checkIn: existing?.checkIn || input.hhmm,
      checkOut: existing?.checkOut ?? null,
      timeOnSite: null,
    };
  }
  const checkIn = existing?.checkIn ?? null;
  const mins = checkIn ? minutesBetweenHHMM(checkIn, input.hhmm) : null;
  return {
    status: existing?.status ?? "PRESENT",
    checkIn,
    checkOut: input.hhmm,
    timeOnSite: mins == null ? null : formatDurationMinutes(mins),
  };
}

export type OccupancyEvent = {
  personKey: string;
  direction: GateDirectionName;
  outcome: string;
  scannedAt: string;
};

/**
 * An unresolved IN stays in the ledger. After the school day boundary, or on a later
 * school date, it is a missing checkout and is no longer current occupancy.
 * An arrival after the boundary stays on site until the next school date.
 */
export function openPresenceState(input: {
  scannedAt: Date;
  now: Date;
  dayBoundary?: string | null;
}): "on_site" | "missing_out" {
  const boundary = validHHMM(input.dayBoundary) ?? DEFAULT_DAY_BOUNDARY;
  const scan = zonedParts(input.scannedAt);
  const current = zonedParts(input.now);
  if (scan.dateKey < current.dateKey) return "missing_out";
  if (scan.dateKey === current.dateKey && current.hhmm >= boundary && scan.hhmm < boundary) return "missing_out";
  return "on_site";
}

/** Latest counting IN without a later OUT. Denied and duplicate scans do not change occupancy. */
export function deriveOnSite<T extends OccupancyEvent>(events: T[]): T[] {
  const latest = new Map<string, T>();
  const sorted = [...events].sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));
  for (const event of sorted) {
    if (event.outcome !== "RECORDED" && event.outcome !== "EARLY_DEPARTURE") continue;
    latest.set(event.personKey, event);
  }
  return [...latest.values()].filter((event) => event.direction === "IN");
}

export function generateCardToken(): string {
  let body = "";
  while (body.length < 16) {
    const bytes = crypto.randomBytes(32);
    for (const byte of bytes) {
      const limit = 256 - (256 % TOKEN_ALPHABET.length);
      if (byte >= limit) continue;
      body += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
      if (body.length === 16) break;
    }
  }
  return `SH${body}`;
}

/**
 * Accept the SchoolHub card token and future opaque reader credentials.
 * Short or punctuated personal numbers are ignored so they cannot be used as cards.
 */
export function normalizeCardToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const token = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{10,40}$/.test(token)) return null;
  return token;
}

export function classifyCard(
  card: { schoolId: string; status: string } | null,
  schoolId: string
): "UNKNOWN" | "WRONG_SCHOOL" | "DEACTIVATED" | "ACTIVE" {
  if (!card) return "UNKNOWN";
  if (card.schoolId !== schoolId) return "WRONG_SCHOOL";
  if (card.status !== "ACTIVE") return "DEACTIVATED";
  return "ACTIVE";
}

/** Client-supplied school ids are discarded. The session school always wins. */
export function tenantWhere<T extends Record<string, unknown>>(schoolId: string, extra?: T): Omit<T, "schoolId"> & { schoolId: string } {
  const rest = { ...(extra ?? {}) } as Record<string, unknown>;
  delete rest.schoolId;
  return { ...rest, schoolId } as Omit<T, "schoolId"> & { schoolId: string };
}

const BIOMETRIC_FIELDS = ["biometricTemplate", "fingerprint", "faceImage", "faceTemplate", "template", "biometricImage"];

export function containsBiometricPayload(body: Record<string, unknown> | null | undefined): boolean {
  if (!body) return false;
  return BIOMETRIC_FIELDS.some((key) => body[key] != null && body[key] !== "");
}

export type GatePerson = {
  personType: PersonKind;
  personId: string;
  studentId: string | null;
  userId: string | null;
  employeeId: string | null;
  classId: string | null;
  accessAllowed: boolean;
  displayName: string;
  number: string | null;
  detailLine: string | null;
  photoUrl: string | null;
};

export function personKey(person: Pick<GatePerson, "personType" | "personId">): string {
  return `${person.personType}:${person.personId}`;
}

export function visitorPersonKey(visitorId: string): string {
  return `VISITOR:${visitorId}`;
}

export function toStudentGatePerson(row: {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  photoUrl?: string | null;
  status: string;
  classId?: string | null;
  userId?: string | null;
  gradeName?: string | null;
  className?: string | null;
  medicalNotes?: string | null;
  saIdNumber?: string | null;
  email?: string | null;
  address?: string | null;
}): GatePerson {
  const detail = [row.gradeName, row.className].filter(Boolean).join(" ");
  return {
    personType: "STUDENT",
    personId: row.id,
    studentId: row.id,
    userId: row.userId ?? null,
    employeeId: null,
    classId: row.classId ?? null,
    accessAllowed: row.status === "ACTIVE",
    displayName: `${row.firstName} ${row.lastName}`.replace(/\s+/g, " ").trim(),
    number: row.studentNumber,
    detailLine: detail || null,
    photoUrl: row.photoUrl ?? null,
  };
}

export function toStaffGatePerson(row: {
  userId?: string | null;
  firstName: string;
  lastName: string;
  isActive?: boolean;
  employeeNumber?: string | null;
  department?: string | null;
  position?: string | null;
  employeeStatus?: string | null;
  employeeId?: string | null;
  photoUrl?: string | null;
  bankAccountLast4?: string | null;
  saIdNumber?: string | null;
  salary?: string | number | null;
}): GatePerson {
  const personId = row.employeeId || row.userId || "";
  const employed = row.employeeStatus ? row.employeeStatus !== "TERMINATED" : true;
  const loginActive = row.userId ? row.isActive !== false : true;
  const allowed = employed && loginActive && Boolean(personId);
  const detail = [row.position, row.department].filter(Boolean).join(" · ");
  return {
    personType: "STAFF",
    personId,
    studentId: null,
    userId: row.userId ?? null,
    employeeId: row.employeeId ?? null,
    classId: null,
    accessAllowed: allowed,
    displayName: `${row.firstName} ${row.lastName}`.replace(/\s+/g, " ").trim(),
    number: row.employeeNumber ?? null,
    detailLine: detail || null,
    photoUrl: row.photoUrl ?? null,
  };
}

export type ReleaseAuthorizationView = {
  id: string;
  schoolId: string;
  studentId: string;
  status: string;
  reason: EarlyDepartureReasonCode;
  validOn: string;
};

/** A later parent/admin approval can satisfy an early exit. The row must belong to this learner and school day. */
export function earlyReleaseCovers(
  authorization: ReleaseAuthorizationView | null,
  input: { schoolId: string; studentId: string; dateKey: string }
): boolean {
  if (!authorization) return false;
  return (
    authorization.status === "APPROVED" &&
    authorization.schoolId === input.schoolId &&
    authorization.studentId === input.studentId &&
    authorization.validOn === input.dateKey
  );
}

export function formatVisitorReference(year: number, sequence: number): string {
  return `V-${year}-${String(sequence).padStart(6, "0")}`;
}

export type VisitorBookAction = "check_in" | "sign_out" | "deny" | "cancel";

export function visitorTransition(input: {
  status: string;
  signedOutAt: Date | null;
  action: VisitorBookAction;
}):
  | { ok: true; status: string; touchSignedIn: boolean; touchSignedOut: boolean; gate: "IN" | "OUT" | "DENIED" | null }
  | { ok: false; message: string } {
  const onSite = !input.signedOutAt && (input.status === "CHECKED_IN" || input.status === "OVERDUE");
  if (input.action === "check_in") {
    if (onSite) return { ok: false, message: "This visitor is already on site" };
    if (input.status === "DENIED" || input.status === "CANCELLED") {
      return { ok: false, message: "This visit cannot be checked in" };
    }
    return { ok: true, status: "CHECKED_IN", touchSignedIn: true, touchSignedOut: false, gate: "IN" };
  }
  if (input.action === "sign_out") {
    if (!onSite) return { ok: false, message: "This visitor has already signed out" };
    return { ok: true, status: "CHECKED_OUT", touchSignedIn: false, touchSignedOut: true, gate: "OUT" };
  }
  if (input.action === "deny") {
    if (onSite) return { ok: false, message: "Sign the visitor out instead of denying an open visit" };
    return { ok: true, status: "DENIED", touchSignedIn: false, touchSignedOut: false, gate: "DENIED" };
  }
  if (onSite) return { ok: false, message: "Sign the visitor out before cancelling" };
  if (input.status === "CHECKED_OUT") return { ok: false, message: "This visit is already closed" };
  return { ok: true, status: "CANCELLED", touchSignedIn: false, touchSignedOut: false, gate: null };
}

export function punctualityLabel(punctuality: "ON_TIME" | "LATE" | "EARLY" | "NORMAL" | null): string | null {
  if (punctuality === "ON_TIME") return "PRESENT — ON TIME";
  if (punctuality === "LATE") return "PRESENT — LATE";
  if (punctuality === "EARLY") return "EARLY DEPARTURE";
  if (punctuality === "NORMAL") return "DEPARTED";
  return null;
}
