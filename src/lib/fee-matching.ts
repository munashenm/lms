import {
  BillingFrequency,
  FeeChargeSource,
  type FeeStructure,
} from "@prisma/client";
import { splitInstalmentAmounts } from "./money";

export interface EnrolmentFeeContext {
  schoolId: string;
  academicYearId: string;
  termId?: string | null;
  campusId?: string | null;
  gradeId?: string | null;
  classId?: string | null;
  courseId?: string | null;
  qualification?: string | null;
  moduleIds: string[];
  hostel?: boolean;
  transport?: boolean;
  startDate: Date;
  yearStart: Date;
  yearEnd: Date;
  termCount: number;
}

export type FeeStructureMatch = Pick<
  FeeStructure,
  | "id"
  | "schoolId"
  | "chargeSource"
  | "academicYearId"
  | "termId"
  | "campusId"
  | "gradeId"
  | "classId"
  | "courseId"
  | "moduleId"
  | "qualification"
  | "applyOnEnrolment"
  | "isActive"
>;

export function feeStructureApplies(fee: FeeStructureMatch, ctx: EnrolmentFeeContext): boolean {
  if (!fee.isActive || !fee.applyOnEnrolment) return false;
  if (fee.schoolId !== ctx.schoolId) return false;
  if (fee.academicYearId && fee.academicYearId !== ctx.academicYearId) return false;
  if (fee.termId && fee.termId !== ctx.termId) return false;
  if (fee.campusId && fee.campusId !== ctx.campusId) return false;
  if (fee.qualification && fee.qualification !== ctx.qualification) return false;

  switch (fee.chargeSource) {
    case FeeChargeSource.GRADE_FEE:
      return Boolean(ctx.gradeId) && (!fee.gradeId || fee.gradeId === ctx.gradeId);
    case FeeChargeSource.CLASS_FEE:
      return Boolean(ctx.classId) && (!fee.classId || fee.classId === ctx.classId);
    case FeeChargeSource.COURSE_FEE:
      return Boolean(ctx.courseId) && (!fee.courseId || fee.courseId === ctx.courseId);
    case FeeChargeSource.MODULE_FEE:
      return Boolean(fee.moduleId && ctx.moduleIds.includes(fee.moduleId));
    case FeeChargeSource.REGISTRATION_FEE:
      if (fee.gradeId && fee.gradeId !== ctx.gradeId) return false;
      if (fee.classId && fee.classId !== ctx.classId) return false;
      if (fee.courseId && fee.courseId !== ctx.courseId) return false;
      return Boolean(ctx.gradeId || ctx.courseId);
    case FeeChargeSource.HOSTEL_FEE:
      return Boolean(ctx.hostel);
    case FeeChargeSource.TRANSPORT_FEE:
      return Boolean(ctx.transport);
    case FeeChargeSource.MANUAL_CHARGE:
      return false;
    default:
      return false;
  }
}

export function instalmentCountFor(
  frequency: BillingFrequency,
  allowInstalments: boolean,
  options?: { instalmentCount?: number | null; customCount?: number; termCount?: number }
): number {
  if (!allowInstalments) return 1;
  if (options?.instalmentCount && options.instalmentCount > 0) return options.instalmentCount;
  switch (frequency) {
    case BillingFrequency.MONTHLY:
      return 12;
    case BillingFrequency.QUARTERLY:
      return 4;
    case BillingFrequency.HALF_YEARLY:
      return 2;
    case BillingFrequency.SEMESTER:
      return 2;
    case BillingFrequency.TERMLY:
      return Math.max(1, options?.termCount ?? 4);
    case BillingFrequency.CUSTOM:
      return Math.max(1, options?.customCount ?? 1);
    case BillingFrequency.ONCE:
    case BillingFrequency.YEARLY:
    default:
      return 1;
  }
}

export interface PlannedInstalment {
  sequence: number;
  amount: number;
  dueDate: Date;
}

export function planInstalments(params: {
  amount: number;
  frequency: BillingFrequency;
  allowInstalments: boolean;
  instalmentCount?: number | null;
  customSchedule?: Array<{ dueDate?: string; amount?: number; dueOffsetDays?: number }> | null;
  startDate: Date;
  yearStart: Date;
  dueDayOfMonth?: number | null;
  termCount?: number;
}): PlannedInstalment[] {
  const custom = params.customSchedule ?? [];
  if (params.allowInstalments && params.frequency === BillingFrequency.CUSTOM && custom.length > 0) {
    return custom.map((row, i) => ({
      sequence: i + 1,
      amount: row.amount ?? 0,
      dueDate: row.dueDate
        ? new Date(row.dueDate)
        : addDays(params.startDate, row.dueOffsetDays ?? 0),
    }));
  }

  const count = instalmentCountFor(params.frequency, params.allowInstalments, {
    instalmentCount: params.instalmentCount,
    customCount: custom.length,
    termCount: params.termCount,
  });
  const amounts = splitInstalmentAmounts(params.amount, count);
  return amounts.map((amount, i) => ({
    sequence: i + 1,
    amount,
    dueDate: instalmentDueDate({
      index: i,
      count,
      frequency: params.frequency,
      startDate: params.startDate,
      yearStart: params.yearStart,
      dueDayOfMonth: params.dueDayOfMonth,
    }),
  }));
}

function instalmentDueDate(params: {
  index: number;
  count: number;
  frequency: BillingFrequency;
  startDate: Date;
  yearStart: Date;
  dueDayOfMonth?: number | null;
}): Date {
  const day = clampDay(params.dueDayOfMonth ?? params.startDate.getUTCDate());
  const base = new Date(Date.UTC(
    params.yearStart.getUTCFullYear(),
    params.yearStart.getUTCMonth(),
    day
  ));
  if (params.count <= 1) return params.startDate;

  switch (params.frequency) {
    case BillingFrequency.MONTHLY:
      return addMonths(base, params.index);
    case BillingFrequency.QUARTERLY:
      return addMonths(base, params.index * 3);
    case BillingFrequency.HALF_YEARLY:
      return addMonths(base, params.index * 6);
    case BillingFrequency.SEMESTER:
      return addMonths(base, params.index * 6);
    case BillingFrequency.TERMLY: {
      const months = Math.max(1, Math.floor(12 / params.count));
      return addMonths(base, params.index * months);
    }
    default:
      return params.index === 0 ? params.startDate : addMonths(base, params.index);
  }
}

function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const d = date.getUTCDate();
  return new Date(Date.UTC(y, m, clampDay(d)));
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function clampDay(day: number): number {
  return Math.min(28, Math.max(1, day));
}

export function chargeIdempotencyKey(
  studentId: string,
  feeStructureId: string,
  academicYearId: string
): string {
  return `fee:${studentId}:${feeStructureId}:${academicYearId}`;
}
