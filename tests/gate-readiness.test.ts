import { describe, expect, it } from "vitest";
import { earlyReleaseCovers, openPresenceState, toStaffGatePerson } from "@/lib/gate/engine";
import { performGateScan } from "@/lib/gate/service";
import { allocateVisitorReference } from "@/lib/gate/visitors";
import { createMemoryGateStore, memoryPerson } from "@/lib/gate/memory-store";
import type { GatePerson } from "@/lib/gate/engine";

function atSast(hhmm: string, day = 2): Date {
  const [hour, minute] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2026, 2, day, hour - 2, minute, 0));
}

const policy = {
  schoolStartTime: "07:30",
  lateAfterMinutes: 0,
  normalDepartureTime: "14:00",
  duplicateScanIntervalSeconds: 90,
  dayBoundaryTime: "18:00",
};

const recorder = { recordedById: "officer-1", recordedByName: "Security Officer" };

function employee(partial: Partial<GatePerson> & Pick<GatePerson, "personId">): GatePerson {
  return {
    personType: "STAFF",
    studentId: null,
    userId: null,
    employeeId: partial.personId,
    classId: null,
    accessAllowed: true,
    displayName: "Grace Dlamini",
    number: "EMP-9",
    detailLine: "Cleaner",
    photoUrl: null,
    ...partial,
  };
}

describe("employees without a login", () => {
  it("builds a gate person from the employee record", () => {
    const person = toStaffGatePerson({
      employeeId: "emp-cleaner",
      userId: null,
      firstName: "Grace",
      lastName: "Dlamini",
      employeeNumber: "EMP-9",
      position: "Cleaner",
      employeeStatus: "ACTIVE",
      bankAccountLast4: "4321",
      salary: 8000,
    });
    expect(person.personId).toBe("emp-cleaner");
    expect(person.userId).toBeNull();
    expect(person.accessAllowed).toBe(true);
    expect(JSON.stringify(person)).not.toContain("4321");
    expect(JSON.stringify(person)).not.toContain("8000");
  });

  it("keeps a user-linked employee on the employee identity and still stores the user id", () => {
    const person = toStaffGatePerson({
      employeeId: "emp-sarah",
      userId: "user-sarah",
      firstName: "Sarah",
      lastName: "Ndlovu",
      isActive: true,
      employeeNumber: "EMP-22",
      employeeStatus: "ACTIVE",
    });
    expect(person.personId).toBe("emp-sarah");
    expect(person.userId).toBe("user-sarah");
  });

  it("records IN and OUT for an employee who has no user account", async () => {
    const person = employee({ personId: "emp-cleaner", employeeId: "emp-cleaner" });
    const { store, state } = createMemoryGateStore({
      policies: { "school-a": policy },
      people: [memoryPerson(person, "school-a")],
      cards: [
        {
          id: "card-c",
          token: "SHCLEANER000000001",
          schoolId: "school-a",
          status: "ACTIVE",
          studentId: null,
          userId: null,
          employeeId: "emp-cleaner",
        },
      ],
    });
    const inn = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "QR",
      token: "SHCLEANER000000001",
      now: atSast("07:10"),
    });
    expect(inn.result.ok).toBe(true);
    expect(inn.result.code).toBe("ENTRY_RECORDED");
    const out = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "OUT",
      method: "QR",
      token: "SHCLEANER000000001",
      now: atSast("15:40"),
    });
    expect(out.result.ok).toBe(true);
    expect(out.result.person?.timeOnSite).toBe("8h 30m");
    expect(state.staffAttendance).toHaveLength(1);
    expect(state.staffAttendance[0]).toMatchObject({
      userId: null,
      employeeId: "emp-cleaner",
      checkIn: "07:10",
      checkOut: "15:40",
      source: "GATE",
      payrollTouched: false,
    });
  });

  it("blocks an employee card that belongs to another school", async () => {
    const person = employee({ personId: "emp-b", employeeId: "emp-b", displayName: "Other School" });
    const { store, state } = createMemoryGateStore({
      policies: { "school-a": policy },
      people: [memoryPerson(person, "school-b")],
      cards: [
        {
          id: "card-b",
          token: "SHOTHERSTAFF000001",
          schoolId: "school-b",
          status: "ACTIVE",
          studentId: null,
          userId: null,
          employeeId: "emp-b",
        },
      ],
    });
    const outcome = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "BARCODE",
      token: "SHOTHERSTAFF000001",
      now: atSast("07:10"),
    });
    expect(outcome.result.code).toBe("WRONG_SCHOOL");
    expect(outcome.result.person).toBeNull();
    expect(state.staffAttendance).toHaveLength(0);
    expect(state.events[0]?.employeeId).toBeNull();
  });
});

describe("missing checkout", () => {
  it("keeps yesterday's unresolved IN off today's occupancy without inventing an OUT", () => {
    const scannedAt = atSast("07:20", 1);
    expect(openPresenceState({ scannedAt, now: atSast("08:00", 2), dayBoundary: "18:00" })).toBe("missing_out");
    expect(openPresenceState({ scannedAt: atSast("07:20", 2), now: atSast("10:00", 2), dayBoundary: "18:00" })).toBe("on_site");
    expect(openPresenceState({ scannedAt: atSast("07:20", 2), now: atSast("18:05", 2), dayBoundary: "18:00" })).toBe("missing_out");
    expect(openPresenceState({ scannedAt: atSast("18:10", 2), now: atSast("19:00", 2), dayBoundary: "18:00" })).toBe("on_site");
  });
});

describe("scan concurrency and attendance rollback", () => {
  it("lets only one of two simultaneous IN scans update attendance", async () => {
    const person = employee({ personId: "emp-cleaner", employeeId: "emp-cleaner" });
    const { store, state } = createMemoryGateStore({
      policies: { "school-a": policy },
      people: [memoryPerson(person, "school-a")],
      cards: [
        {
          id: "card-c",
          token: "SHCLEANER000000001",
          schoolId: "school-a",
          status: "ACTIVE",
          studentId: null,
          userId: null,
          employeeId: "emp-cleaner",
        },
      ],
    });
    const request = {
      schoolId: "school-a",
      ...recorder,
      direction: "IN" as const,
      method: "QR" as const,
      token: "SHCLEANER000000001",
      now: atSast("07:10"),
    };
    const [first, second] = await Promise.all([performGateScan(store, request), performGateScan(store, request)]);
    const codes = [first.result.code, second.result.code].sort();
    expect(codes).toEqual(["ALREADY_CHECKED_IN", "ENTRY_RECORDED"]);
    expect(state.events.filter((event) => event.outcome === "RECORDED")).toHaveLength(1);
    expect(state.staffAttendance).toHaveLength(1);
    expect(state.staffAttendance[0]?.checkIn).toBe("07:10");
  });

  it("rolls the gate event back when the attendance write fails", async () => {
    const person = employee({ personId: "emp-cleaner", employeeId: "emp-cleaner" });
    const { store, state } = createMemoryGateStore(
      {
        policies: { "school-a": policy },
        people: [memoryPerson(person, "school-a")],
        cards: [
          {
            id: "card-c",
            token: "SHCLEANER000000001",
            schoolId: "school-a",
            status: "ACTIVE",
            studentId: null,
            userId: null,
            employeeId: "emp-cleaner",
          },
        ],
      },
      { failStaffSave: true }
    );
    await expect(
      performGateScan(store, {
        schoolId: "school-a",
        ...recorder,
        direction: "IN",
        method: "QR",
        token: "SHCLEANER000000001",
        now: atSast("07:10"),
      })
    ).rejects.toThrow("staff attendance write failed");
    expect(state.events).toHaveLength(0);
    expect(state.staffAttendance).toHaveLength(0);
  });
});

describe("visitor reference allocation", () => {
  it("gives simultaneous desks distinct reference numbers", async () => {
    let value = 0;
    let chain: Promise<void> = Promise.resolve();
    async function claim() {
      const run = chain.then(async () => {
        value += 1;
        return value;
      });
      chain = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    }
    const refs = await Promise.all(
      Array.from({ length: 25 }, () => allocateVisitorReference("school-a", atSast("08:00"), claim))
    );
    expect(new Set(refs).size).toBe(25);
    expect(refs[0]).toBe("V-2026-000001");
    expect(refs[24]).toBe("V-2026-000025");
  });
});

describe("early release authorization", () => {
  it("accepts only an approved authorization for this learner and school day", () => {
    const authorization = {
      id: "rel-1",
      schoolId: "school-a",
      studentId: "stu-1",
      status: "APPROVED",
      reason: "PARENT_COLLECTION" as const,
      validOn: "2026-03-02",
    };
    expect(earlyReleaseCovers(authorization, { schoolId: "school-a", studentId: "stu-1", dateKey: "2026-03-02" })).toBe(true);
    expect(earlyReleaseCovers(authorization, { schoolId: "school-b", studentId: "stu-1", dateKey: "2026-03-02" })).toBe(false);
    expect(earlyReleaseCovers({ ...authorization, status: "PENDING" }, { schoolId: "school-a", studentId: "stu-1", dateKey: "2026-03-02" })).toBe(false);
    expect(earlyReleaseCovers(authorization, { schoolId: "school-a", studentId: "stu-2", dateKey: "2026-03-02" })).toBe(false);
  });
});
