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
  userId: string;
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

export function createMemoryGateStore(seed?: Partial<MemoryState>): { store: GateStore; state: MemoryState } {
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
      return state.people.find((person) => {
        if (person.personType === "STUDENT") return person.studentId === card.studentId;
        return person.userId === card.userId;
      }) ?? null;
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
    async getStaffAttendance(_schoolId, userId, date) {
      const row = state.staffAttendance.find((record) => record.userId === userId && record.dateKey === dateKey(date));
      if (!row) return null;
      return { status: row.status, checkIn: row.checkIn, checkOut: row.checkOut };
    },
    async saveStaffAttendance(input) {
      const key = dateKey(input.date);
      let row = state.staffAttendance.find((record) => record.userId === input.userId && record.dateKey === key);
      if (!row) {
        row = {
          userId: input.userId,
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
    },
  };

  return { store, state };
}

export function memoryPerson(person: GatePerson, schoolId: string): MemoryPerson {
  return { ...person, schoolId };
}
