import type { GateDirectionName, GateMethodName, GatePerson, SavedGatePolicy } from "./engine";
import type { CardRow, GateStore } from "./service";

export type MemoryCard = CardRow & { token: string };
export type MemoryPerson = GatePerson & { schoolId: string };

export type MemoryAttendance = {
  studentId: string;
  sessionKey: string;
  dateKey: string;
  status: string;
  gateArrivalAt: string | null;
  gateDepartureAt: string | null;
  classId: string | null;
};

export type MemoryStaffAttendance = {
  userId: string | null;
  employeeId: string | null;
  dateKey: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  source: string;
  payrollTouched: boolean;
};

export type MemoryEvent = {
  id: string;
  schoolId: string;
  personKey: string;
  studentId: string | null;
  userId: string | null;
  employeeId: string | null;
  direction: GateDirectionName;
  method: GateMethodName;
  outcome: string;
  denialCode: string | null;
  punctuality: string | null;
  earlyDepartureReason: string | null;
  scannedAt: string;
  manualReason: string | null;
  duplicateOfId: string | null;
};

export type MemoryState = {
  policies: Record<string, SavedGatePolicy | null>;
  timetables: Record<string, { starts: string[]; ends: string[] }>;
  cards: MemoryCard[];
  people: MemoryPerson[];
  gates: Array<{ id: string; schoolId: string }>;
  events: MemoryEvent[];
  attendance: MemoryAttendance[];
  staffAttendance: MemoryStaffAttendance[];
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function cloneState(state: MemoryState): MemoryState {
  return {
    policies: { ...state.policies },
    timetables: { ...state.timetables },
    cards: state.cards.map((card) => ({ ...card })),
    people: state.people.map((person) => ({ ...person })),
    gates: state.gates.map((gate) => ({ ...gate })),
    events: state.events.map((event) => ({ ...event })),
    attendance: state.attendance.map((row) => ({ ...row })),
    staffAttendance: state.staffAttendance.map((row) => ({ ...row })),
  };
}

function restoreState(target: MemoryState, snapshot: MemoryState) {
  target.policies = snapshot.policies;
  target.timetables = snapshot.timetables;
  target.cards = snapshot.cards;
  target.people = snapshot.people;
  target.gates = snapshot.gates;
  target.events = snapshot.events;
  target.attendance = snapshot.attendance;
  target.staffAttendance = snapshot.staffAttendance;
}

export function createMemoryGateStore(
  seed?: Partial<MemoryState>,
  options?: { failDailySave?: boolean; failStaffSave?: boolean }
): { store: GateStore; state: MemoryState } {
  const state: MemoryState = {
    policies: seed?.policies ?? {},
    timetables: seed?.timetables ?? {},
    cards: seed?.cards ?? [],
    people: seed?.people ?? [],
    gates: seed?.gates ?? [],
    events: seed?.events ?? [],
    attendance: seed?.attendance ?? [],
    staffAttendance: seed?.staffAttendance ?? [],
  };
  let seq = 1;
  const tails = new Map<string, Promise<void>>();

  const store: GateStore = {
    async getSavedPolicy(schoolId) {
      return state.policies[schoolId] ?? null;
    },
    async timetableWindow(schoolId, classId, weekday) {
      if (!classId) return { starts: [], ends: [] };
      return state.timetables[`${schoolId}:${classId}:${weekday}`] ?? { starts: [], ends: [] };
    },
    async findCardByToken(token) {
      return state.cards.find((card) => card.token === token) ?? null;
    },
    async personFromCard(schoolId, card) {
      if (card.schoolId !== schoolId) return null;
      return (
        state.people.find((person) => {
          if (person.schoolId !== schoolId) return false;
          if (person.personType === "STUDENT") return person.studentId === card.studentId;
          if (card.employeeId && person.employeeId === card.employeeId) return true;
          return Boolean(card.userId) && person.userId === card.userId;
        }) ?? null
      );
    },
    async findPerson(schoolId, personType, personId) {
      return state.people.find((person) => person.schoolId === schoolId && person.personType === personType && person.personId === personId) ?? null;
    },
    async gateBelongsToSchool(schoolId, gateId) {
      return state.gates.some((gate) => gate.id === gateId && gate.schoolId === schoolId);
    },
    async lastCountingEvent(schoolId, key) {
      const matches = state.events.filter(
        (event) => event.schoolId === schoolId && event.personKey === key && (event.outcome === "RECORDED" || event.outcome === "EARLY_DEPARTURE")
      );
      const last = matches[matches.length - 1];
      if (!last) return null;
      return { id: last.id, direction: last.direction, scannedAt: new Date(last.scannedAt) };
    },
    async createEvent(input) {
      const id = `evt-${seq++}`;
      state.events.push({
        id,
        schoolId: input.schoolId,
        personKey: input.personKey,
        studentId: input.studentId,
        userId: input.userId,
        employeeId: input.employeeId,
        direction: input.direction,
        method: input.method,
        outcome: input.outcome,
        denialCode: input.denialCode,
        punctuality: input.punctuality,
        earlyDepartureReason: input.earlyDepartureReason,
        scannedAt: input.scannedAt.toISOString(),
        manualReason: input.manualReason,
        duplicateOfId: input.duplicateOfId,
      });
      return { id };
    },
    async getDailyAttendance(_schoolId, studentId, date) {
      const row = state.attendance.find((record) => record.studentId === studentId && record.sessionKey === "daily" && record.dateKey === dateKey(date));
      if (!row) return null;
      return { status: row.status, gateArrivalAt: row.gateArrivalAt ? new Date(row.gateArrivalAt) : null };
    },
    async saveDailyAttendance(input) {
      if (options?.failDailySave) throw new Error("attendance write failed");
      const key = dateKey(input.date);
      let row = state.attendance.find((record) => record.studentId === input.studentId && record.sessionKey === "daily" && record.dateKey === key);
      if (!row) {
        row = {
          studentId: input.studentId,
          sessionKey: "daily",
          dateKey: key,
          status: input.status ?? "PRESENT",
          gateArrivalAt: null,
          gateDepartureAt: null,
          classId: input.classId,
        };
        state.attendance.push(row);
      } else if (input.status) {
        row.status = input.status;
      }
      if (input.setArrival && !row.gateArrivalAt) row.gateArrivalAt = input.scannedAt.toISOString();
      if (input.setDeparture) row.gateDepartureAt = input.scannedAt.toISOString();
    },
    async getStaffAttendance(_schoolId, identity, date) {
      const key = dateKey(date);
      const row = state.staffAttendance.find((record) => {
        if (record.dateKey !== key) return false;
        if (identity.employeeId && record.employeeId === identity.employeeId) return true;
        return Boolean(identity.userId) && record.userId === identity.userId;
      });
      if (!row) return null;
      return { status: row.status, checkIn: row.checkIn, checkOut: row.checkOut };
    },
    async saveStaffAttendance(input) {
      if (options?.failStaffSave) throw new Error("staff attendance write failed");
      const key = dateKey(input.date);
      let row = state.staffAttendance.find((record) => {
        if (record.dateKey !== key) return false;
        if (input.employeeId && record.employeeId === input.employeeId) return true;
        return Boolean(input.userId) && record.userId === input.userId;
      });
      if (!row) {
        row = {
          userId: input.userId,
          employeeId: input.employeeId,
          dateKey: key,
          status: input.status,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          source: "GATE",
          payrollTouched: false,
        };
        state.staffAttendance.push(row);
        return;
      }
      row.status = input.status;
      row.checkIn = input.checkIn;
      row.checkOut = input.checkOut;
      row.source = "GATE";
      row.payrollTouched = false;
      if (input.employeeId) row.employeeId = input.employeeId;
      if (input.userId) row.userId = input.userId;
    },
    async runLocked(schoolId, personKey, fn) {
      const key = `${schoolId}:${personKey}`;
      const previous = tails.get(key) ?? Promise.resolve();
      let release: () => void = () => undefined;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      tails.set(
        key,
        previous.then(() => current)
      );
      await previous;
      const snapshot = cloneState(state);
      try {
        return await fn(store);
      } catch (error) {
        restoreState(state, snapshot);
        throw error;
      } finally {
        release();
      }
    },
  };

  return { store, state };
}

export function memoryPerson(person: GatePerson, schoolId: string): MemoryPerson {
  return { ...person, schoolId };
}
