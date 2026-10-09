import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { hasPermission, canAccessAdmin, canAccessFinance, canAccessSecurityPortal } from "@/lib/rbac";
import { ROLE_DASHBOARD } from "@/lib/constants";
import { dashboardForRole } from "@/lib/login-portals";
import {
  classifyCard,
  containsBiometricPayload,
  decideMovement,
  deriveOnSite,
  formatDurationMinutes,
  formatVisitorReference,
  generateCardToken,
  minutesBetweenHHMM,
  nextDailyAttendance,
  normalizeCardToken,
  resolveSchoolDay,
  tenantWhere,
  toStaffGatePerson,
  toStudentGatePerson,
  visitorTransition,
} from "@/lib/gate/engine";
import { performGateScan } from "@/lib/gate/service";
import { createMemoryGateStore, memoryPerson, type MemoryPerson } from "@/lib/gate/memory-store";
import type { GatePerson } from "@/lib/gate/engine";

function atSast(hhmm: string, extraSeconds = 0): Date {
  const [hour, minute] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2026, 2, 2, hour - 2, minute, extraSeconds));
}

const policy = {
  schoolStartTime: "07:30",
  lateAfterMinutes: 0,
  normalDepartureTime: "14:00",
  duplicateScanIntervalSeconds: 90,
};

function learner(): MemoryPerson {
  return memoryPerson(
    {
      personType: "STUDENT",
      personId: "stu-1",
      studentId: "stu-1",
      userId: null,
      employeeId: null,
      classId: "class-1",
      accessAllowed: true,
      displayName: "Thabo Mokoena",
      number: "L-1001",
      detailLine: "Grade 10A",
      photoUrl: "/uploads/school-a/students/stu-1/photo.jpg",
    },
    "school-a"
  );
}

function staff(): MemoryPerson {
  return memoryPerson(
    {
      personType: "STAFF",
      personId: "user-sarah",
      studentId: null,
      userId: "user-sarah",
      employeeId: "emp-sarah",
      classId: null,
      accessAllowed: true,
      displayName: "Sarah Ndlovu",
      number: "EMP-22",
      detailLine: "Educator",
      photoUrl: null,
    },
    "school-a"
  );
}

function baseStore(people: MemoryPerson[] = [learner(), staff()]) {
  return createMemoryGateStore({
    policies: { "school-a": policy, "school-b": policy },
    people,
    cards: [
      { id: "card-1", token: "SHACTIVE0000000001", schoolId: "school-a", status: "ACTIVE", studentId: "stu-1", userId: null, employeeId: null },
      { id: "card-2", token: "SHDEACTIVATED00001", schoolId: "school-a", status: "DEACTIVATED", studentId: "stu-1", userId: null, employeeId: null },
      { id: "card-3", token: "SHOTHERSCHOOL00001", schoolId: "school-b", status: "ACTIVE", studentId: "stu-b", userId: null, employeeId: null },
      { id: "card-4", token: "SHSTAFFACTIVE00001", schoolId: "school-a", status: "ACTIVE", studentId: null, userId: "user-sarah", employeeId: "emp-sarah" },
    ],
    attendance: [
      {
        studentId: "stu-1",
        sessionKey: "subject:math:class:class-1",
        dateKey: "2026-03-02",
        status: "ABSENT",
        gateArrivalAt: null,
        gateDepartureAt: null,
        classId: "class-1",
      },
    ],
  });
}

const recorder = { recordedById: "sec-1", recordedByName: "Security Officer" };

describe("SECURITY role", () => {
  it("lands on the security portal and cannot open finance, payroll, marks, or admin", () => {
    expect(ROLE_DASHBOARD[UserRole.SECURITY]).toBe("/security");
    expect(dashboardForRole(UserRole.SECURITY)).toBe("/security");
    expect(canAccessSecurityPortal(UserRole.SECURITY)).toBe(true);
    expect(canAccessAdmin(UserRole.SECURITY)).toBe(false);
    expect(canAccessFinance(UserRole.SECURITY)).toBe(false);
    expect(hasPermission(UserRole.SECURITY, "gate:scan")).toBe(true);
    expect(hasPermission(UserRole.SECURITY, "gate:manual")).toBe(true);
    expect(hasPermission(UserRole.SECURITY, "visitors:write")).toBe(true);
    expect(hasPermission(UserRole.SECURITY, "students:read")).toBe(false);
    expect(hasPermission(UserRole.SECURITY, "staff:read")).toBe(false);
    expect(hasPermission(UserRole.SECURITY, "marks:read")).toBe(false);
    expect(hasPermission(UserRole.SECURITY, "marks:write")).toBe(false);
    expect(hasPermission(UserRole.SECURITY, "finance:read")).toBe(false);
    expect(hasPermission(UserRole.SECURITY, "payroll.view")).toBe(false);
    expect(hasPermission(UserRole.SECURITY, "settings:write")).toBe(false);
    expect(hasPermission(UserRole.SECURITY, "cards:manage")).toBe(false);
    expect(hasPermission(UserRole.SCHOOL_ADMIN, "cards:manage")).toBe(true);
    expect(hasPermission(UserRole.SCHOOL_ADMIN, "gate:manage")).toBe(true);
  });
});

describe("gate identity", () => {
  it("keeps sensitive learner and staff fields off the security view", () => {
    const student = toStudentGatePerson({
      id: "stu-1",
      firstName: "Thabo",
      lastName: "Mokoena",
      studentNumber: "L-1001",
      status: "ACTIVE",
      gradeName: "Grade 10",
      className: "10A",
      medicalNotes: "asthma",
      saIdNumber: "0001015800085",
      email: "thabo@example.com",
      address: "12 Main",
    });
    expect(student.displayName).toBe("Thabo Mokoena");
    expect(student.detailLine).toBe("Grade 10 10A");
    expect(student).not.toHaveProperty("medicalNotes");
    expect(student).not.toHaveProperty("saIdNumber");
    expect(JSON.stringify(student)).not.toContain("asthma");

    const employee = toStaffGatePerson({
      userId: "u1",
      firstName: "Sarah",
      lastName: "Ndlovu",
      isActive: true,
      position: "Educator",
      bankAccountLast4: "9988",
      saIdNumber: "8001015800085",
      salary: 25000,
    });
    expect(employee.detailLine).toBe("Educator");
    expect(JSON.stringify(employee)).not.toContain("9988");
    expect(JSON.stringify(employee)).not.toContain("25000");
  });

  it("issues an opaque token that is not a learner number", () => {
    const token = generateCardToken();
    expect(token).toMatch(/^SH[A-Z2-9]{16}$/);
    expect(token).not.toContain("L-1001");
    expect(normalizeCardToken("l-1001")).toBeNull();
    expect(normalizeCardToken("  shactive0000000001 ")).toBe("SHACTIVE0000000001");
  });

  it("blocks another school's card without revealing the person", () => {
    expect(classifyCard(null, "school-a")).toBe("UNKNOWN");
    expect(classifyCard({ schoolId: "school-b", status: "ACTIVE" }, "school-a")).toBe("WRONG_SCHOOL");
    expect(classifyCard({ schoolId: "school-a", status: "DEACTIVATED" }, "school-a")).toBe("DEACTIVATED");
    expect(tenantWhere("school-a", { schoolId: "school-b", personId: "stu-b" })).toEqual({
      personId: "stu-b",
      schoolId: "school-a",
    });
  });
});

describe("gate scans", () => {
  it("records a learner entry and daily attendance without changing class attendance", async () => {
    const { store, state } = baseStore();
    const outcome = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "QR",
      token: "SHACTIVE0000000001",
      now: atSast("07:23"),
    });
    expect(outcome.result.ok).toBe(true);
    expect(outcome.result.title).toBe("ACCESS CONFIRMED");
    expect(outcome.result.detail).toBe("ENTRY RECORDED");
    expect(outcome.result.person?.displayName).toBe("Thabo Mokoena");
    expect(outcome.result.person?.detailLine).toBe("Grade 10A");
    expect(outcome.result.person?.time).toBe("07:23");
    expect(outcome.result.person?.punctualityLabel).toBe("PRESENT — ON TIME");
    const daily = state.attendance.find((row) => row.sessionKey === "daily");
    const maths = state.attendance.find((row) => row.sessionKey.startsWith("subject:"));
    expect(daily?.status).toBe("PRESENT");
    expect(maths?.status).toBe("ABSENT");
    expect(outcome.audit.action).toBe("GATE_ENTRY");
  });

  it("marks a learner late from the saved school start time", async () => {
    const { store, state } = baseStore();
    const outcome = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "BARCODE",
      token: "SHACTIVE0000000001",
      now: atSast("07:31"),
    });
    expect(outcome.result.person?.punctualityLabel).toBe("PRESENT — LATE");
    expect(state.attendance.find((row) => row.sessionKey === "daily")?.status).toBe("LATE");
  });

  it("uses the timetable when the school has not saved gate settings", () => {
    const day = resolveSchoolDay({
      saved: null,
      timetableStarts: ["08:00", "09:00"],
      timetableEnds: ["14:30", "15:00"],
    });
    expect(day.source).toBe("timetable");
    expect(day.startTime).toBe("08:00");
    expect(day.departureTime).toBe("15:00");
  });

  it("does not create a second attendance record for a duplicate scan", async () => {
    const { store, state } = baseStore();
    await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "QR",
      token: "SHACTIVE0000000001",
      now: atSast("07:23"),
    });
    const second = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "QR",
      token: "SHACTIVE0000000001",
      now: atSast("07:23", 30),
    });
    expect(second.result.code).toBe("ALREADY_CHECKED_IN");
    expect(state.events.filter((event) => event.outcome === "RECORDED")).toHaveLength(1);
    expect(state.events.some((event) => event.outcome === "DUPLICATE")).toBe(true);
    expect(state.attendance.filter((row) => row.sessionKey === "daily")).toHaveLength(1);
  });

  it("rejects a deactivated card and an unknown card", async () => {
    const { store, state } = baseStore();
    const dead = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "QR",
      token: "SHDEACTIVATED00001",
      now: atSast("07:20"),
    });
    expect(dead.result.code).toBe("CARD_DEACTIVATED");
    expect(dead.result.person?.displayName).toBe("Thabo Mokoena");
    expect(state.attendance.some((row) => row.sessionKey === "daily")).toBe(false);

    const unknown = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "QR",
      token: "SHDOESNOTEXIST0001",
      now: atSast("07:21"),
    });
    expect(unknown.result.code).toBe("CARD_NOT_RECOGNISED");
    expect(unknown.result.person).toBeNull();
    expect(JSON.stringify(unknown.result)).not.toContain("stu-");
  });

  it("blocks a card from another school and does not copy that learner onto this school's event", async () => {
    const { store, state } = baseStore();
    const outcome = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "QR",
      token: "SHOTHERSCHOOL00001",
      now: atSast("07:22"),
    });
    expect(outcome.result.code).toBe("WRONG_SCHOOL");
    expect(outcome.result.person).toBeNull();
    expect(state.events.every((event) => event.schoolId === "school-a")).toBe(true);
    expect(state.events.every((event) => event.studentId !== "stu-b")).toBe(true);
  });

  it("records a manual entry with the security officer and reason", async () => {
    const { store, state } = baseStore();
    const outcome = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "MANUAL",
      personType: "STUDENT",
      personId: "stu-1",
      manualReason: "Scanner failed",
      now: atSast("07:46"),
    });
    expect(outcome.result.ok).toBe(true);
    expect(outcome.result.person?.manualNote).toBe("Entry manually recorded by Security Officer at 07:46.");
    expect(state.events[0]?.manualReason).toBe("Scanner failed");
    expect(outcome.audit.action).toBe("GATE_MANUAL_IN");
  });

  it("does not let a manual id from another school resolve", async () => {
    const foreign = memoryPerson({ ...(learner() as GatePerson), personId: "stu-b", studentId: "stu-b" }, "school-b");
    const { store } = baseStore([learner(), staff(), foreign]);
    const outcome = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "MANUAL",
      personType: "STUDENT",
      personId: "stu-b",
      manualReason: "Trying another school",
      now: atSast("07:10"),
    });
    expect(outcome.result.code).toBe("ACCESS_DENIED");
    expect(outcome.result.person).toBeNull();
  });

  it("records learner exit and flags an early departure until a reason is given", async () => {
    const { store, state } = baseStore();
    await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "QR",
      token: "SHACTIVE0000000001",
      now: atSast("07:23"),
    });
    const early = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "OUT",
      method: "QR",
      token: "SHACTIVE0000000001",
      now: atSast("11:05"),
    });
    expect(early.result.code).toBe("EARLY_DEPARTURE");
    expect(state.attendance.find((row) => row.sessionKey === "daily")?.gateDepartureAt).toBeNull();

    const released = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "OUT",
      method: "QR",
      token: "SHACTIVE0000000001",
      earlyDepartureReason: "PARENT_COLLECTION",
      now: atSast("11:06"),
    });
    expect(released.result.ok).toBe(true);
    expect(released.result.detail).toBe("EARLY DEPARTURE");
    expect(state.events.some((event) => event.outcome === "EARLY_DEPARTURE" && event.earlyDepartureReason === "PARENT_COLLECTION")).toBe(true);
    expect(state.attendance.find((row) => row.sessionKey === "daily")?.gateDepartureAt).toBeTruthy();
    expect(state.attendance.find((row) => row.sessionKey.startsWith("subject:"))?.status).toBe("ABSENT");
  });

  it("records staff arrival and departure with time on site and no payroll change", async () => {
    const { store, state } = baseStore();
    const inn = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "QR",
      token: "SHSTAFFACTIVE00001",
      now: atSast("07:04"),
    });
    expect(inn.result.person?.displayName).toBe("Sarah Ndlovu");
    expect(inn.result.person?.punctualityLabel).toBe("PRESENT — ON TIME");
    const out = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "OUT",
      method: "QR",
      token: "SHSTAFFACTIVE00001",
      now: atSast("16:12"),
    });
    expect(out.result.person?.timeOnSite).toBe("9h 08m");
    expect(state.staffAttendance[0]?.checkIn).toBe("07:04");
    expect(state.staffAttendance[0]?.checkOut).toBe("16:12");
    expect(state.staffAttendance[0]?.payrollTouched).toBe(false);
    expect(state.staffAttendance[0]?.source).toBe("GATE");
  });

  it("rejects biometric templates", async () => {
    const { store } = baseStore();
    const outcome = await performGateScan(store, {
      schoolId: "school-a",
      ...recorder,
      direction: "IN",
      method: "BIOMETRIC",
      token: "SHACTIVE0000000001",
      rawBody: { biometricTemplate: "template-bytes" },
      now: atSast("07:23"),
    });
    expect(outcome.result.code).toBe("ACCESS_DENIED");
    expect(containsBiometricPayload({ faceImage: "abc" })).toBe(true);
  });
});

describe("occupancy and visitors", () => {
  it("counts people from the latest valid in and out, not from daily attendance status", () => {
    const onSite = deriveOnSite([
      { personKey: "STUDENT:1", direction: "IN", outcome: "RECORDED", scannedAt: "2026-03-02T05:00:00.000Z" },
      { personKey: "STUDENT:1", direction: "IN", outcome: "DUPLICATE", scannedAt: "2026-03-02T05:01:00.000Z" },
      { personKey: "STUDENT:2", direction: "IN", outcome: "RECORDED", scannedAt: "2026-03-02T05:02:00.000Z" },
      { personKey: "STUDENT:2", direction: "OUT", outcome: "RECORDED", scannedAt: "2026-03-02T06:00:00.000Z" },
      { personKey: "STAFF:1", direction: "IN", outcome: "RECORDED", scannedAt: "2026-03-02T05:03:00.000Z" },
    ]);
    expect(onSite.map((row) => row.personKey).sort()).toEqual(["STAFF:1", "STUDENT:1"]);
  });

  it("checks a visitor in and out", () => {
    expect(formatVisitorReference(2026, 1048)).toBe("V-2026-001048");
    const checkedIn = visitorTransition({ status: "EXPECTED", signedOutAt: null, action: "check_in" });
    expect(checkedIn).toMatchObject({ ok: true, status: "CHECKED_IN", gate: "IN" });
    const checkedOut = visitorTransition({ status: "CHECKED_IN", signedOutAt: null, action: "sign_out" });
    expect(checkedOut).toMatchObject({ ok: true, status: "CHECKED_OUT", gate: "OUT" });
    const denied = visitorTransition({ status: "EXPECTED", signedOutAt: null, action: "deny" });
    expect(denied).toMatchObject({ ok: true, status: "DENIED", gate: "DENIED" });
  });

  it("leaves an excused daily mark in place and still records the gate", () => {
    expect(nextDailyAttendance({ existingStatus: "EXCUSED", direction: "IN", punctuality: "ON_TIME" }).status).toBeNull();
    expect(nextDailyAttendance({ existingStatus: "ABSENT", direction: "IN", punctuality: "LATE" }).status).toBe("LATE");
    expect(nextDailyAttendance({ existingStatus: "PRESENT", direction: "OUT", punctuality: "NORMAL" })).toMatchObject({
      status: null,
      setDeparture: true,
    });
  });
});

describe("movement rules", () => {
  it("requires a reason before an early learner exit", () => {
    const decision = decideMovement({
      direction: "OUT",
      now: atSast("11:00"),
      last: { id: "evt-1", direction: "IN", scannedAt: atSast("07:23") },
      duplicateIntervalSeconds: 90,
      personType: "STUDENT",
      hhmm: "11:00",
      lateCutoff: "07:30",
      departureTime: "14:00",
    });
    expect(decision.kind).toBe("need_reason");
  });

  it("formats staff time on site", () => {
    expect(minutesBetweenHHMM("07:04", "16:12")).toBe(9 * 60 + 8);
    expect(formatDurationMinutes(9 * 60 + 8)).toBe("9h 08m");
  });
});
