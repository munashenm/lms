import {
  EARLY_DEPARTURE_REASONS,
  type EarlyDepartureReasonCode,
  type GateDirectionName,
  type GateMethodName,
  type GatePerson,
  type PersonKind,
  classifyCard,
  containsBiometricPayload,
  decideMovement,
  nextDailyAttendance,
  nextStaffAttendance,
  normalizeCardToken,
  personKey,
  punctualityLabel,
  resolveSchoolDay,
  zonedParts,
  type SavedGatePolicy,
} from "./engine";

/**
 * Scan pipeline used by QR, barcode, camera, manual entry, and future readers.
 * RFID/NFC and biometric terminals should resolve a person to an opaque
 * credential and call this service with method RFID or BIOMETRIC.
 * Biometric templates and images are rejected and never stored.
 */
export type ScanRequest = {
  schoolId: string;
  recordedById: string;
  recordedByName: string;
  direction: GateDirectionName;
  method: GateMethodName;
  token?: string | null;
  personType?: PersonKind | null;
  personId?: string | null;
  gateId?: string | null;
  deviceId?: string | null;
  notes?: string | null;
  manualReason?: string | null;
  earlyDepartureReason?: string | null;
  earlyDepartureNote?: string | null;
  now?: Date;
  bypassDuplicate?: boolean;
  rawBody?: Record<string, unknown> | null;
};

export type ScanPersonView = {
  personType: PersonKind;
  displayName: string;
  number: string | null;
  detailLine: string | null;
  photoUrl: string | null;
  time: string;
  punctualityLabel: string | null;
  timeOnSite: string | null;
  attendanceLabel: string | null;
  manualNote: string | null;
};

export type ScanCode =
  | "ENTRY_RECORDED"
  | "EXIT_RECORDED"
  | "CARD_NOT_RECOGNISED"
  | "CARD_DEACTIVATED"
  | "ALREADY_CHECKED_IN"
  | "ALREADY_CHECKED_OUT"
  | "ACCESS_DENIED"
  | "WRONG_SCHOOL"
  | "EARLY_DEPARTURE"
  | "NOT_ON_SITE"
  | "INVALID";

export type ScanResult = {
  ok: boolean;
  code: ScanCode;
  title: string;
  detail: string;
  person: ScanPersonView | null;
};

export type ScanAudit = {
  action: string;
  entity: "GateEvent";
  entityId?: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type ScanOutcome = { result: ScanResult; audit: ScanAudit };

export type CardRow = {
  id: string;
  schoolId: string;
  status: string;
  studentId: string | null;
  userId: string | null;
  employeeId: string | null;
};

export type GateStore = {
  getSavedPolicy(schoolId: string): Promise<SavedGatePolicy | null>;
  timetableWindow(schoolId: string, classId: string | null, weekday: string): Promise<{ starts: string[]; ends: string[] }>;
  findCardByToken(token: string): Promise<CardRow | null>;
  personFromCard(schoolId: string, card: CardRow): Promise<GatePerson | null>;
  findPerson(schoolId: string, personType: PersonKind, personId: string): Promise<GatePerson | null>;
  gateBelongsToSchool(schoolId: string, gateId: string): Promise<boolean>;
  lastCountingEvent(schoolId: string, key: string): Promise<{ id: string; direction: GateDirectionName; scannedAt: Date } | null>;
  createEvent(input: {
    schoolId: string;
    personType: "STUDENT" | "STAFF" | "VISITOR";
    personKey: string;
    studentId: string | null;
    userId: string | null;
    employeeId: string | null;
    direction: GateDirectionName;
    method: GateMethodName;
    gateId: string | null;
    deviceId: string | null;
    scannedAt: Date;
    recordedById: string;
    outcome: "RECORDED" | "DUPLICATE" | "DENIED" | "EARLY_DEPARTURE";
    punctuality: "ON_TIME" | "LATE" | "EARLY" | "NORMAL" | "UNKNOWN" | null;
    denialCode: string | null;
    earlyDepartureReason: EarlyDepartureReasonCode | null;
    earlyDepartureNote: string | null;
    notes: string | null;
    manualReason: string | null;
    duplicateOfId: string | null;
  }): Promise<{ id: string }>;
  getDailyAttendance(schoolId: string, studentId: string, date: Date): Promise<{ status: string; gateArrivalAt: Date | null } | null>;
  saveDailyAttendance(input: {
    schoolId: string;
    studentId: string;
    classId: string | null;
    date: Date;
    status: "PRESENT" | "LATE" | null;
    setArrival: boolean;
    setDeparture: boolean;
    scannedAt: Date;
    recordedById: string;
  }): Promise<void>;
  getStaffAttendance(
    schoolId: string,
    identity: { userId: string | null; employeeId: string | null },
    date: Date
  ): Promise<{ status: string; checkIn: string | null; checkOut: string | null } | null>;
  saveStaffAttendance(input: {
    schoolId: string;
    userId: string | null;
    employeeId: string | null;
    date: Date;
    status: string;
    checkIn: string | null;
    checkOut: string | null;
    recordedById: string;
  }): Promise<void>;
  /**
   * Holds a per-person lock and a database transaction around the movement decision,
   * the gate event, and the attendance write. A failed attendance write rolls the event back.
   */
  runLocked<T>(schoolId: string, personKey: string, fn: (store: GateStore) => Promise<T>): Promise<T>;
};

function emptyAudit(action: string, metadata: Record<string, string | number | boolean | null>): ScanAudit {
  return { action, entity: "GateEvent", metadata };
}

function failure(
  code: ScanCode,
  title: string,
  detail: string,
  auditAction: string,
  metadata: Record<string, string | number | boolean | null>,
  person: ScanPersonView | null = null
): ScanOutcome {
  return {
    result: { ok: false, code, title, detail, person },
    audit: emptyAudit(auditAction, metadata),
  };
}

function personView(
  person: GatePerson,
  hhmm: string,
  label: string | null,
  timeOnSite: string | null,
  attendanceLabel: string | null,
  manualNote: string | null
): ScanPersonView {
  return {
    personType: person.personType,
    displayName: person.displayName,
    number: person.number,
    detailLine: person.detailLine,
    photoUrl: person.photoUrl,
    time: hhmm,
    punctualityLabel: label,
    timeOnSite,
    attendanceLabel,
    manualNote,
  };
}

function parseReason(value: string | null | undefined): EarlyDepartureReasonCode | null {
  if (!value) return null;
  return (EARLY_DEPARTURE_REASONS as readonly string[]).includes(value) ? (value as EarlyDepartureReasonCode) : null;
}

export async function performGateScan(store: GateStore, request: ScanRequest): Promise<ScanOutcome> {
  if (containsBiometricPayload(request.rawBody)) {
    return failure(
      "ACCESS_DENIED",
      "ACCESS DENIED",
      "Biometric capture is not enabled.",
      "GATE_BIOMETRIC_REJECTED",
      { method: request.method }
    );
  }

  const now = request.now ?? new Date();
  const saved = await store.getSavedPolicy(request.schoolId);
  const clock = zonedParts(now);
  const manual = request.method === "MANUAL";

  if (manual && !request.manualReason?.trim()) {
    return failure("INVALID", "MANUAL ENTRY", "A reason is required for manual entry.", "GATE_MANUAL_REJECTED", {
      direction: request.direction,
    });
  }
  if (manual && request.personType !== "STUDENT" && request.personType !== "STAFF") {
    return failure("INVALID", "MANUAL ENTRY", "Choose a learner or staff member.", "GATE_MANUAL_REJECTED", {
      direction: request.direction,
    });
  }
  if (!manual && request.method !== "QR" && request.method !== "BARCODE" && request.method !== "CAMERA" && request.method !== "RFID" && request.method !== "NFC" && request.method !== "BIOMETRIC") {
    return failure("INVALID", "ACCESS DENIED", "This scan method is not available.", "GATE_METHOD_REJECTED", {
      method: request.method,
    });
  }

  let person: GatePerson | null = null;
  let gateId: string | null = null;
  if (request.gateId) {
    const ownsGate = await store.gateBelongsToSchool(request.schoolId, request.gateId);
    if (!ownsGate) {
      return failure("ACCESS_DENIED", "ACCESS DENIED", "Checkpoint not recognised.", "GATE_DENIED", {
        denialCode: "UNKNOWN_GATE",
      });
    }
    gateId = request.gateId;
  }

  if (!manual) {
    const token = normalizeCardToken(request.token);
    if (!token) {
      const created = await store.createEvent(deniedEvent(request, now, gateId, "UNKNOWN", "UNKNOWN_CARD"));
      return {
        ...failure("CARD_NOT_RECOGNISED", "CARD NOT RECOGNISED", "This card is not a SchoolHub card for this school.", "GATE_DENIED", {
          denialCode: "UNKNOWN_CARD",
        }),
        audit: { ...emptyAudit("GATE_DENIED", { denialCode: "UNKNOWN_CARD" }), entityId: created.id },
      };
    }
    const card = await store.findCardByToken(token);
    const classification = classifyCard(card, request.schoolId);
    if (classification === "UNKNOWN" || classification === "WRONG_SCHOOL") {
      const code = classification === "WRONG_SCHOOL" ? "WRONG_SCHOOL" : "UNKNOWN_CARD";
      const created = await store.createEvent(deniedEvent(request, now, gateId, "UNKNOWN", code));
      const title = classification === "WRONG_SCHOOL" ? "WRONG SCHOOL" : "CARD NOT RECOGNISED";
      const detail = classification === "WRONG_SCHOOL"
        ? "This card belongs to another school."
        : "This card is not a SchoolHub card for this school.";
      return {
        result: { ok: false, code: classification === "WRONG_SCHOOL" ? "WRONG_SCHOOL" : "CARD_NOT_RECOGNISED", title, detail, person: null },
        audit: { action: "GATE_DENIED", entity: "GateEvent", entityId: created.id, metadata: { denialCode: code } },
      };
    }
    person = await store.personFromCard(request.schoolId, card!);
    if (!person) {
      const created = await store.createEvent(deniedEvent(request, now, gateId, "UNKNOWN", "UNKNOWN_CARD"));
      return {
        result: { ok: false, code: "CARD_NOT_RECOGNISED", title: "CARD NOT RECOGNISED", detail: "This card is not a SchoolHub card for this school.", person: null },
        audit: { action: "GATE_DENIED", entity: "GateEvent", entityId: created.id, metadata: { denialCode: "UNKNOWN_CARD" } },
      };
    }
    if (classification === "DEACTIVATED") {
      const created = await store.createEvent({
        ...eventBase(request, person, now, gateId),
        outcome: "DENIED",
        punctuality: null,
        denialCode: "DEACTIVATED",
        earlyDepartureReason: null,
        earlyDepartureNote: null,
        duplicateOfId: null,
      });
      return {
        result: {
          ok: false,
          code: "CARD_DEACTIVATED",
          title: "CARD DEACTIVATED",
          detail: "This card has been deactivated. Ask the school office for a replacement.",
          person: personView(person, clock.hhmm, null, null, null, null),
        },
        audit: { action: "GATE_CARD_DEACTIVATED", entity: "GateEvent", entityId: created.id, metadata: { denialCode: "DEACTIVATED", personType: person.personType } },
      };
    }
  } else {
    person = await store.findPerson(request.schoolId, request.personType as PersonKind, request.personId ?? "");
    if (!person) {
      return failure("ACCESS_DENIED", "ACCESS DENIED", "This person is not on the school register.", "GATE_DENIED", {
        denialCode: "UNKNOWN_PERSON",
      });
    }
  }

  if (!person) {
    return failure("ACCESS_DENIED", "ACCESS DENIED", "This person is not on the school register.", "GATE_DENIED", {
      denialCode: "UNKNOWN_PERSON",
    });
  }

  return store.runLocked(request.schoolId, personKey(person), async (locked) =>
    completeMovement(locked, request, person, now, clock, gateId, saved, manual)
  );
}

async function completeMovement(
  store: GateStore,
  request: ScanRequest,
  person: GatePerson,
  now: Date,
  clock: ReturnType<typeof zonedParts>,
  gateId: string | null,
  saved: SavedGatePolicy | null,
  manual: boolean
): Promise<ScanOutcome> {
  if (!person.accessAllowed) {
    const created = await store.createEvent({
      ...eventBase(request, person, now, gateId),
      outcome: "DENIED",
      punctuality: null,
      denialCode: "ACCESS_DENIED",
      earlyDepartureReason: null,
      earlyDepartureNote: null,
      duplicateOfId: null,
    });
    return {
      result: {
        ok: false,
        code: "ACCESS_DENIED",
        title: "ACCESS DENIED",
        detail: "This person is not cleared for gate access.",
        person: personView(person, clock.hhmm, null, null, null, null),
      },
      audit: { action: "GATE_DENIED", entity: "GateEvent", entityId: created.id, metadata: { denialCode: "ACCESS_DENIED", personType: person.personType } },
    };
  }

  const timetable = await store.timetableWindow(request.schoolId, person.classId, clock.weekday);
  const day = resolveSchoolDay({ saved, timetableStarts: timetable.starts, timetableEnds: timetable.ends });
  const reason = parseReason(request.earlyDepartureReason);
  const decision = decideMovement({
    direction: request.direction,
    now,
    last: await store.lastCountingEvent(request.schoolId, personKey(person)),
    duplicateIntervalSeconds: day.duplicateScanIntervalSeconds,
    personType: person.personType,
    hhmm: clock.hhmm,
    lateCutoff: day.lateCutoff,
    departureTime: day.departureTime,
    earlyDepartureReason: reason,
    bypassDuplicate: request.bypassDuplicate,
  });

  if (decision.kind !== "record") {
    const created = await store.createEvent({
      ...eventBase(request, person, now, gateId),
      outcome: decision.outcome,
      punctuality: null,
      denialCode: decision.denialCode,
      earlyDepartureReason: null,
      earlyDepartureNote: null,
      duplicateOfId: decision.kind === "duplicate" ? decision.duplicateOfId : null,
    });
    const mapped = mapDenied(decision.denialCode);
    return {
      result: {
        ok: false,
        code: mapped.code,
        title: mapped.title,
        detail: mapped.detail,
        person: personView(person, clock.hhmm, null, null, null, null),
      },
      audit: {
        action: decision.kind === "duplicate" ? "GATE_DUPLICATE" : "GATE_DENIED",
        entity: "GateEvent",
        entityId: created.id,
        metadata: { denialCode: decision.denialCode, personType: person.personType, direction: request.direction },
      },
    };
  }

  const created = await store.createEvent({
    ...eventBase(request, person, now, gateId),
    outcome: decision.outcome,
    punctuality: decision.punctuality,
    denialCode: null,
    earlyDepartureReason: decision.earlyDepartureReason,
    earlyDepartureNote: decision.earlyDepartureReason ? request.earlyDepartureNote?.trim() || null : null,
    duplicateOfId: null,
  });

  let timeOnSite: string | null = null;
  let attendanceLabel = punctualityLabel(decision.punctuality);
  if (person.personType === "STUDENT" && person.studentId) {
    const existing = await store.getDailyAttendance(request.schoolId, person.studentId, clock.dateUtc);
    const next = nextDailyAttendance({
      existingStatus: existing?.status ?? null,
      direction: request.direction,
      punctuality: decision.punctuality,
    });
    await store.saveDailyAttendance({
      schoolId: request.schoolId,
      studentId: person.studentId,
      classId: person.classId,
      date: clock.dateUtc,
      status: next.status,
      setArrival: next.setArrival && !existing?.gateArrivalAt,
      setDeparture: next.setDeparture,
      scannedAt: now,
      recordedById: request.recordedById,
    });
    if (existing?.status === "SICK" || existing?.status === "EXCUSED") {
      attendanceLabel = existing.status === "SICK" ? "Daily attendance: Sick" : "Daily attendance: Excused";
    }
  }
  if (person.personType === "STAFF" && (person.userId || person.employeeId)) {
    const identity = { userId: person.userId, employeeId: person.employeeId };
    const existing = await store.getStaffAttendance(request.schoolId, identity, clock.dateUtc);
    const next = nextStaffAttendance({
      existing,
      direction: request.direction,
      hhmm: clock.hhmm,
      punctuality: decision.punctuality,
    });
    timeOnSite = next.timeOnSite;
    await store.saveStaffAttendance({
      schoolId: request.schoolId,
      userId: person.userId,
      employeeId: person.employeeId,
      date: clock.dateUtc,
      status: next.status,
      checkIn: next.checkIn,
      checkOut: next.checkOut,
      recordedById: request.recordedById,
    });
    if (request.direction === "IN") {
      attendanceLabel = next.status === "LATE" ? "PRESENT — LATE" : next.status === "ON_LEAVE" ? "ON LEAVE" : "PRESENT — ON TIME";
    }
  }

  const manualNote = manual
    ? `${request.direction === "IN" ? "Entry" : "Exit"} manually recorded by ${request.recordedByName} at ${clock.hhmm}.`
    : null;
  const code = request.direction === "IN" ? "ENTRY_RECORDED" : "EXIT_RECORDED";
  const detail = request.direction === "IN" ? "ENTRY RECORDED" : decision.outcome === "EARLY_DEPARTURE" ? "EARLY DEPARTURE" : "EXIT RECORDED";
  return {
    result: {
      ok: true,
      code,
      title: "ACCESS CONFIRMED",
      detail,
      person: personView(person, clock.hhmm, attendanceLabel, timeOnSite, attendanceLabel, manualNote),
    },
    audit: {
      action: manual ? (request.direction === "IN" ? "GATE_MANUAL_IN" : "GATE_MANUAL_OUT") : request.direction === "IN" ? "GATE_ENTRY" : "GATE_EXIT",
      entity: "GateEvent",
      entityId: created.id,
      metadata: {
        personType: person.personType,
        direction: request.direction,
        method: request.method,
        punctuality: decision.punctuality,
        outcome: decision.outcome,
      },
    },
  };
}

function eventBase(request: ScanRequest, person: GatePerson, now: Date, gateId: string | null) {
  return {
    schoolId: request.schoolId,
    personType: person.personType as "STUDENT" | "STAFF",
    personKey: personKey(person),
    studentId: person.studentId,
    userId: person.userId,
    employeeId: person.employeeId,
    direction: request.direction,
    method: request.method,
    gateId,
    deviceId: request.deviceId?.trim() || null,
    scannedAt: now,
    recordedById: request.recordedById,
    notes: request.notes?.trim() || null,
    manualReason: request.method === "MANUAL" ? request.manualReason?.trim() || null : null,
  };
}

function deniedEvent(request: ScanRequest, now: Date, gateId: string | null, key: string, denialCode: string) {
  return {
    schoolId: request.schoolId,
    personType: "STUDENT" as const,
    personKey: key,
    studentId: null,
    userId: null,
    employeeId: null,
    direction: request.direction,
    method: request.method,
    gateId,
    deviceId: request.deviceId?.trim() || null,
    scannedAt: now,
    recordedById: request.recordedById,
    outcome: "DENIED" as const,
    punctuality: null,
    denialCode,
    earlyDepartureReason: null,
    earlyDepartureNote: null,
    notes: null,
    manualReason: null,
    duplicateOfId: null,
  };
}

function mapDenied(code: string): { code: ScanCode; title: string; detail: string } {
  if (code === "ALREADY_IN") {
    return { code: "ALREADY_CHECKED_IN", title: "ALREADY CHECKED IN", detail: "This person is already signed in at the gate." };
  }
  if (code === "ALREADY_OUT") {
    return { code: "ALREADY_CHECKED_OUT", title: "ALREADY CHECKED OUT", detail: "This person is already signed out." };
  }
  if (code === "NOT_ON_SITE") {
    return { code: "NOT_ON_SITE", title: "NOT ON SITE", detail: "There is no open entry to sign out." };
  }
  if (code === "EARLY_DEPARTURE_REASON_REQUIRED") {
    return {
      code: "EARLY_DEPARTURE",
      title: "EARLY DEPARTURE",
      detail: "Record why this learner is leaving before the normal departure time.",
    };
  }
  return { code: "ACCESS_DENIED", title: "ACCESS DENIED", detail: "This person is not cleared for gate access." };
}
