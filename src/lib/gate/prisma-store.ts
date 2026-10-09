import {
  AttendanceStatus,
  DayOfWeek,
  EarlyDepartureReason,
  GateDirection,
  GateEventOutcome,
  GatePersonType,
  GatePunctuality,
  GateScanMethod,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { toStaffGatePerson, toStudentGatePerson, type EarlyDepartureReasonCode, type SavedGatePolicy } from "./engine";
import type { CardRow, GateStore } from "./service";

const STUDENT_SELECT = {
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

const STAFF_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  isActive: true,
  avatarUrl: true,
  teacher: { select: { employeeNumber: true, department: true } },
  employee: { select: { id: true, employeeNumber: true, department: true, position: true, status: true } },
} satisfies Prisma.UserSelect;

function asDirection(value: string): GateDirection {
  return value === "OUT" ? GateDirection.OUT : GateDirection.IN;
}

function asMethod(value: string): GateScanMethod {
  if (value === "BARCODE") return GateScanMethod.BARCODE;
  if (value === "CAMERA") return GateScanMethod.CAMERA;
  if (value === "RFID") return GateScanMethod.RFID;
  if (value === "NFC") return GateScanMethod.NFC;
  if (value === "BIOMETRIC") return GateScanMethod.BIOMETRIC;
  if (value === "MANUAL") return GateScanMethod.MANUAL;
  return GateScanMethod.QR;
}

function asOutcome(value: string): GateEventOutcome {
  if (value === "DUPLICATE") return GateEventOutcome.DUPLICATE;
  if (value === "DENIED") return GateEventOutcome.DENIED;
  if (value === "EARLY_DEPARTURE") return GateEventOutcome.EARLY_DEPARTURE;
  return GateEventOutcome.RECORDED;
}

function asPunctuality(value: string | null): GatePunctuality | null {
  if (value === "ON_TIME") return GatePunctuality.ON_TIME;
  if (value === "LATE") return GatePunctuality.LATE;
  if (value === "EARLY") return GatePunctuality.EARLY;
  if (value === "NORMAL") return GatePunctuality.NORMAL;
  if (value === "UNKNOWN") return GatePunctuality.UNKNOWN;
  return null;
}

function asReason(value: EarlyDepartureReasonCode | null): EarlyDepartureReason | null {
  if (!value) return null;
  return value as EarlyDepartureReason;
}

function weekdayEnum(weekday: string): DayOfWeek | null {
  if ((Object.values(DayOfWeek) as string[]).includes(weekday)) return weekday as DayOfWeek;
  return null;
}

async function loadStudent(schoolId: string, studentId: string, client: Prisma.TransactionClient = prisma as unknown as Prisma.TransactionClient) {
  const student = await client.student.findFirst({
    where: { id: studentId, schoolId },
    select: STUDENT_SELECT,
  });
  if (!student) return null;
  return toStudentGatePerson({
    ...student,
    gradeName: student.grade?.name ?? null,
    className: student.class?.name ?? null,
  });
}

async function loadEmployee(schoolId: string, employeeId: string, client: Prisma.TransactionClient = prisma as unknown as Prisma.TransactionClient) {
  const employee = await client.employee.findFirst({
    where: { id: employeeId, schoolId },
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
  });
  if (!employee) return null;
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

async function loadStaff(schoolId: string, userId: string, client: Prisma.TransactionClient = prisma as unknown as Prisma.TransactionClient) {
  const user = await client.user.findFirst({
    where: { id: userId, schoolId },
    select: STAFF_SELECT,
  });
  if (!user) return null;
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

export function createPrismaGateStore(client: Prisma.TransactionClient = prisma as unknown as Prisma.TransactionClient, nested = false): GateStore {
  const db = client;
  return {
    async getSavedPolicy(schoolId) {
      const policy = await db.gatePolicy.findUnique({ where: { schoolId } });
      if (!policy) return null;
      const saved: SavedGatePolicy = {
        schoolStartTime: policy.schoolStartTime,
        lateAfterMinutes: policy.lateAfterMinutes,
        normalDepartureTime: policy.normalDepartureTime,
        duplicateScanIntervalSeconds: policy.duplicateScanIntervalSeconds,
        dayBoundaryTime: policy.dayBoundaryTime,
      };
      return saved;
    },
    async timetableWindow(schoolId, classId, weekday) {
      const day = classId ? weekdayEnum(weekday) : null;
      if (!classId || !day) return { starts: [], ends: [] };
      const slots = await db.timetableSlot.findMany({
        where: { schoolId, classId, dayOfWeek: day },
        select: { startTime: true, endTime: true },
      });
      return { starts: slots.map((slot) => slot.startTime), ends: slots.map((slot) => slot.endTime) };
    },
    async findCardByToken(token) {
      const card = await db.accessCard.findUnique({ where: { token } });
      if (!card) return null;
      const row: CardRow = {
        id: card.id,
        schoolId: card.schoolId,
        status: card.status,
        studentId: card.studentId,
        userId: card.userId,
        employeeId: card.employeeId,
      };
      return row;
    },
    async personFromCard(schoolId, card) {
      if (card.schoolId !== schoolId) return null;
      if (card.studentId) return loadStudent(schoolId, card.studentId, db);
      if (card.employeeId) {
        const employee = await loadEmployee(schoolId, card.employeeId, db);
        if (employee) return employee;
      }
      if (card.userId) return loadStaff(schoolId, card.userId, db);
      return null;
    },
    async findPerson(schoolId, personType, personId) {
      if (personType === "STUDENT") return loadStudent(schoolId, personId, db);
      const employee = await loadEmployee(schoolId, personId, db);
      if (employee) return employee;
      return loadStaff(schoolId, personId, db);
    },
    async gateBelongsToSchool(schoolId, gateId) {
      const gate = await db.gateCheckpoint.findFirst({
        where: { id: gateId, schoolId },
        select: { id: true },
      });
      return Boolean(gate);
    },
    async lastCountingEvent(schoolId, key) {
      const event = await db.gateEvent.findFirst({
        where: {
          schoolId,
          personKey: key,
          outcome: { in: [GateEventOutcome.RECORDED, GateEventOutcome.EARLY_DEPARTURE] },
        },
        orderBy: { scannedAt: "desc" },
        select: { id: true, direction: true, scannedAt: true },
      });
      if (!event) return null;
      return { id: event.id, direction: event.direction, scannedAt: event.scannedAt };
    },
    async createEvent(input) {
      const created = await db.gateEvent.create({
        data: {
          schoolId: input.schoolId,
          personType: input.personType === "STAFF" ? GatePersonType.STAFF : input.personType === "VISITOR" ? GatePersonType.VISITOR : GatePersonType.STUDENT,
          personKey: input.personKey,
          studentId: input.studentId,
          userId: input.userId,
          employeeId: input.employeeId,
          direction: asDirection(input.direction),
          method: asMethod(input.method),
          gateId: input.gateId,
          deviceId: input.deviceId,
          scannedAt: input.scannedAt,
          recordedById: input.recordedById,
          outcome: asOutcome(input.outcome),
          punctuality: asPunctuality(input.punctuality),
          denialCode: input.denialCode,
          earlyDepartureReason: asReason(input.earlyDepartureReason),
          earlyDepartureNote: input.earlyDepartureNote,
          notes: input.notes,
          manualReason: input.manualReason,
          duplicateOfId: input.duplicateOfId,
        },
        select: { id: true },
      });
      return created;
    },
    async getDailyAttendance(schoolId, studentId, date) {
      const row = await db.attendanceRecord.findFirst({
        where: { schoolId, studentId, date, sessionKey: "daily" },
        select: { status: true, gateArrivalAt: true },
      });
      if (!row) return null;
      return { status: row.status, gateArrivalAt: row.gateArrivalAt };
    },
    async saveDailyAttendance(input) {
      const existing = await db.attendanceRecord.findFirst({
        where: { schoolId: input.schoolId, studentId: input.studentId, date: input.date, sessionKey: "daily" },
        select: { id: true, gateArrivalAt: true },
      });
      const status = input.status === "LATE" ? AttendanceStatus.LATE : input.status === "PRESENT" ? AttendanceStatus.PRESENT : undefined;
      if (!existing) {
        await db.attendanceRecord.create({
          data: {
            schoolId: input.schoolId,
            studentId: input.studentId,
            classId: input.classId,
            date: input.date,
            sessionKey: "daily",
            status: status ?? AttendanceStatus.PRESENT,
            gateArrivalAt: input.setArrival ? input.scannedAt : null,
            gateDepartureAt: input.setDeparture ? input.scannedAt : null,
            markedBy: input.recordedById,
            notes: "Recorded from the school gate",
          },
        });
        return;
      }
      await db.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          ...(status ? { status } : {}),
          ...(input.setArrival && !existing.gateArrivalAt ? { gateArrivalAt: input.scannedAt } : {}),
          ...(input.setDeparture ? { gateDepartureAt: input.scannedAt } : {}),
        },
      });
    },
    async getStaffAttendance(schoolId, identity, date) {
      const row = await db.staffAttendanceRecord.findFirst({
        where: {
          schoolId,
          date,
          OR: [
            ...(identity.employeeId ? [{ employeeId: identity.employeeId }] : []),
            ...(identity.userId ? [{ userId: identity.userId }] : []),
          ],
        },
        select: { status: true, checkIn: true, checkOut: true },
      });
      if (!row) return null;
      return { status: row.status, checkIn: row.checkIn, checkOut: row.checkOut };
    },
    async saveStaffAttendance(input) {
      const existing = await db.staffAttendanceRecord.findFirst({
        where: {
          schoolId: input.schoolId,
          date: input.date,
          OR: [
            ...(input.employeeId ? [{ employeeId: input.employeeId }] : []),
            ...(input.userId ? [{ userId: input.userId }] : []),
          ],
        },
        select: { id: true },
      });
      const data = {
        status: input.status as Prisma.StaffAttendanceRecordUpdateInput["status"],
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        source: "GATE",
        markedById: input.recordedById,
        employeeId: input.employeeId,
      };
      if (!existing) {
        await db.staffAttendanceRecord.create({
          data: {
            schoolId: input.schoolId,
            userId: input.userId,
            date: input.date,
            status: input.status as Prisma.StaffAttendanceRecordCreateInput["status"],
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            source: "GATE",
            markedById: input.recordedById,
            employeeId: input.employeeId,
            overtimeMinutes: 0,
          },
        });
        return;
      }
      await db.staffAttendanceRecord.update({
        where: { id: existing.id },
        data,
      });
    },
    async runLocked(schoolId, personKey, fn) {
      if (nested) return fn(createPrismaGateStore(db, true));
      return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${schoolId}), hashtext(${personKey}))`;
        return fn(createPrismaGateStore(tx as unknown as Prisma.TransactionClient, true));
      });
    },
  };
}
