import { describe, expect, it } from "vitest";
import { FeeChargeSource, BillingFrequency, UserRole } from "@prisma/client";
import { splitInstalmentAmounts, roundMoney, addMoney } from "@/lib/money";
import { amountInWordsZar } from "@/lib/amount-in-words";
import {
  chargeIdempotencyKey,
  feeStructureApplies,
  instalmentCountFor,
  planInstalments,
  type EnrolmentFeeContext,
} from "@/lib/fee-matching";
import { calculateEmployeePay, EMPTY_PAYROLL_RULES } from "@/lib/payroll-engine";
import { hasPermission } from "@/lib/rbac";
import { DEFAULT_LICENSE_FEATURES } from "@/lib/licensing/features";

const ctx: EnrolmentFeeContext = {
  schoolId: "sch-1",
  academicYearId: "year-1",
  termId: "term-1",
  campusId: "camp-1",
  gradeId: "g10",
  classId: "c10a",
  courseId: "bsc-cs",
  qualification: "BSc Computer Science",
  moduleIds: ["mod-prog", "mod-db", "mod-ai"],
  startDate: new Date("2026-01-15T00:00:00Z"),
  yearStart: new Date("2026-01-01T00:00:00Z"),
  yearEnd: new Date("2026-12-31T00:00:00Z"),
  termCount: 4,
};

function fee(overrides: Partial<Parameters<typeof feeStructureApplies>[0]>) {
  return {
    id: "fee-1",
    schoolId: "sch-1",
    chargeSource: FeeChargeSource.GRADE_FEE,
    academicYearId: "year-1",
    termId: null,
    campusId: null,
    gradeId: "g10",
    classId: null,
    courseId: null,
    moduleId: null,
    qualification: null,
    applyOnEnrolment: true,
    isActive: true,
    ...overrides,
  };
}

describe("money", () => {
  it("splits R12,000 monthly into 12 instalments of R1,000", () => {
    expect(splitInstalmentAmounts(12000, 12)).toEqual(Array(12).fill(1000));
  });

  it("splits remainder cents onto the first instalments", () => {
    expect(splitInstalmentAmounts(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(roundMoney(addMoney(33.34, 33.33, 33.33))).toBe(100);
  });
});

describe("fee matching", () => {
  it("matches grade tuition and ignores other institutions", () => {
    expect(feeStructureApplies(fee({}), ctx)).toBe(true);
    expect(feeStructureApplies(fee({ schoolId: "other" }), ctx)).toBe(false);
    expect(feeStructureApplies(fee({ gradeId: "g11" }), ctx)).toBe(false);
  });

  it("matches selected module fees only", () => {
    expect(
      feeStructureApplies(
        fee({ chargeSource: FeeChargeSource.MODULE_FEE, moduleId: "mod-ai", gradeId: null }),
        ctx
      )
    ).toBe(true);
    expect(
      feeStructureApplies(
        fee({ chargeSource: FeeChargeSource.MODULE_FEE, moduleId: "mod-other", gradeId: null }),
        ctx
      )
    ).toBe(false);
  });

  it("does not auto-apply hostel or manual charges", () => {
    expect(feeStructureApplies(fee({ chargeSource: FeeChargeSource.HOSTEL_FEE, gradeId: null }), ctx)).toBe(false);
    expect(feeStructureApplies(fee({ chargeSource: FeeChargeSource.MANUAL_CHARGE, gradeId: null }), ctx)).toBe(false);
    expect(
      feeStructureApplies(fee({ chargeSource: FeeChargeSource.HOSTEL_FEE, gradeId: null }), { ...ctx, hostel: true })
    ).toBe(true);
  });

  it("does not split unless instalments are allowed", () => {
    expect(instalmentCountFor(BillingFrequency.MONTHLY, false)).toBe(1);
    expect(instalmentCountFor(BillingFrequency.MONTHLY, true)).toBe(12);
    expect(instalmentCountFor(BillingFrequency.QUARTERLY, true)).toBe(4);
    expect(instalmentCountFor(BillingFrequency.HALF_YEARLY, true)).toBe(2);
    const planned = planInstalments({
      amount: 12000,
      frequency: BillingFrequency.MONTHLY,
      allowInstalments: true,
      startDate: ctx.startDate,
      yearStart: ctx.yearStart,
    });
    expect(planned).toHaveLength(12);
    expect(planned[0].amount).toBe(1000);
  });

  it("uses a stable idempotency key per student, fee and year", () => {
    const a = chargeIdempotencyKey("stu", "fee", "year");
    const b = chargeIdempotencyKey("stu", "fee", "year");
    expect(a).toBe(b);
    expect(chargeIdempotencyKey("stu", "fee", "year-2")).not.toBe(a);
  });
});

describe("payroll rules", () => {
  it("does not invent tax when rule percents are zero", () => {
    const result = calculateEmployeePay(
      { payType: "MONTHLY", baseSalary: 20000, allowances: [{ name: "Housing", amount: 2000 }] },
      EMPTY_PAYROLL_RULES
    );
    expect(result.grossPay).toBe(22000);
    expect(result.totalDeductions).toBe(0);
    expect(result.netPay).toBe(22000);
  });

  it("applies versioned percents from configuration only", () => {
    const result = calculateEmployeePay(
      { payType: "MONTHLY", baseSalary: 10000 },
      { employeeTaxPercent: 10, uifEmployerPercent: 1 }
    );
    expect(result.totalDeductions).toBe(1000);
    expect(result.netPay).toBe(9000);
    expect(result.employerContributions).toBe(100);
  });
});

describe("RBAC isolation", () => {
  it("does not grant finance or payroll to teachers", () => {
    expect(hasPermission(UserRole.TEACHER, "finance:write")).toBe(false);
    expect(hasPermission(UserRole.TEACHER, "finance.payments.create")).toBe(false);
    expect(hasPermission(UserRole.TEACHER, "payroll.finalise")).toBe(false);
    expect(hasPermission(UserRole.TEACHER, "hr.employees.manage")).toBe(false);
  });

  it("keeps finance officers off payroll and HR officers off student billing writes", () => {
    expect(hasPermission(UserRole.FINANCE_OFFICER, "payroll.finalise")).toBe(false);
    expect(hasPermission(UserRole.FINANCE_OFFICER, "hr.employees.manage")).toBe(false);
    expect(hasPermission(UserRole.HR_OFFICER, "finance:write")).toBe(false);
    expect(hasPermission(UserRole.HR_OFFICER, "payroll.finalise")).toBe(true);
    expect(hasPermission(UserRole.SCHOOL_ADMIN, "finance.fees.manage")).toBe(true);
  });
});

describe("licensing", () => {
  it("treats HR/Payroll as a separately licensable module", () => {
    expect(DEFAULT_LICENSE_FEATURES.hr_payroll).toBe(false);
    expect(DEFAULT_LICENSE_FEATURES.finance).toBe(true);
  });
});

describe("amount in words", () => {
  it("describes rand amounts for receipts", () => {
    expect(amountInWordsZar(1500)).toContain("rand");
    expect(amountInWordsZar(0)).toBe("zero rand");
  });
});
