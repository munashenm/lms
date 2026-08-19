import { describe, expect, it } from "vitest";
import { AccrualMethod, LeaveType, RecurringInterval, FeeChargeSource, BillingFrequency, UserRole } from "@prisma/client";
import { splitInstalmentAmounts, roundMoney, addMoney } from "@/lib/money";
import { amountInWordsZar } from "@/lib/amount-in-words";
import {
  chargeIdempotencyKey,
  feeStructureApplies,
  instalmentCountFor,
  planInstalments,
  type EnrolmentFeeContext,
} from "@/lib/fee-matching";
import { calculateEmployeePay, EMPTY_PAYROLL_RULES, parsePayrollRules } from "@/lib/payroll-engine";
import { hoursBetweenHhmm, parseClockPunches } from "@/lib/clock-hours";
import { hasPermission } from "@/lib/rbac";
import { remainingLeaveDays, accruedDaysFor, unpaidLeaveDoesNotConsume } from "@/lib/leave-balance";
import { DEFAULT_LICENSE_FEATURES } from "@/lib/licensing/features";
import { advanceRecurringDate } from "@/lib/recurring-schedule";
import { sumTimesheetHours, visibleEmployeeDocuments } from "@/lib/timesheet-hours";
import { chargeOutstanding, selectedAllocations, unpaidInstalmentIds } from "@/lib/charge-reversal";
import { isCollectedPayment } from "@/lib/finance";
import { reversingLedgerAmount } from "@/lib/payroll-reversal";
import { payrollListingCsv, payrollListingRows, PAYROLL_LISTING_HEADERS } from "@/lib/payroll-listing";
import { matchCourseId, matchGradeId, shouldCreateStudentOnAccept } from "@/lib/application-enrolment";
import { FINANCE_SLIP_TYPES, saveFinanceSlip } from "@/lib/finance-uploads";
import { financeOpsSectionCsv, type FinanceOpsReport } from "@/lib/finance-ops-report";

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
    expect(instalmentCountFor(BillingFrequency.ONCE, true, { instalmentCount: 3 })).toBe(3);
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
    expect(hasPermission(UserRole.FINANCE_OFFICER, "hr.view")).toBe(false);
    expect(hasPermission(UserRole.FINANCE_OFFICER, "reports:read")).toBe(true);
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

describe("leave entitlements", () => {
  it("grants the full configured days when accrual is NONE or YEARLY", () => {
    expect(
      accruedDaysFor({
        daysPerYear: 15,
        method: AccrualMethod.NONE,
        cycleYear: 2026,
        asOf: new Date("2026-06-15T00:00:00Z"),
      })
    ).toBe(15);
    expect(
      accruedDaysFor({
        daysPerYear: 21,
        method: AccrualMethod.YEARLY,
        cycleYear: 2026,
        asOf: new Date("2026-02-01T00:00:00Z"),
      })
    ).toBe(21);
  });

  it("accrues monthly from the policy days, without hard-coded BCEA tables", () => {
    expect(
      accruedDaysFor({
        daysPerYear: 12,
        method: AccrualMethod.MONTHLY,
        cycleYear: 2026,
        asOf: new Date("2026-06-15T00:00:00Z"),
      })
    ).toBe(6);
  });

  it("computes remaining as opening + accrued - taken", () => {
    expect(remainingLeaveDays({ openingBalance: 2, accrued: 10, taken: 3 })).toBe(9);
  });

  it("does not consume unpaid leave", () => {
    expect(unpaidLeaveDoesNotConsume(LeaveType.UNPAID)).toBe(true);
    expect(unpaidLeaveDoesNotConsume(LeaveType.ANNUAL)).toBe(false);
  });
});

describe("recurring expenses", () => {
  it("advances the next due date by the configured interval", () => {
    const from = new Date("2026-01-15T00:00:00Z");
    expect(advanceRecurringDate(from, RecurringInterval.MONTHLY).toISOString().slice(0, 10)).toBe("2026-02-15");
    expect(advanceRecurringDate(from, RecurringInterval.QUARTERLY).toISOString().slice(0, 10)).toBe("2026-04-15");
    expect(advanceRecurringDate(from, RecurringInterval.YEARLY).toISOString().slice(0, 10)).toBe("2027-01-15");
  });
});

describe("timesheets and documents", () => {
  it("sums hours and overtime to two decimal places", () => {
    expect(sumTimesheetHours([{ hours: 8 }, { hours: 7.5, overtimeHours: 2 }])).toEqual({
      totalHours: 15.5,
      overtimeHours: 2,
    });
  });

  it("converts check-in/out clock times to hours, including overnight shifts", () => {
    expect(hoursBetweenHhmm("08:00", "16:30")).toBe(8.5);
    expect(hoursBetweenHhmm("22:00", "06:00")).toBe(8);
    expect(hoursBetweenHhmm("08:00", null)).toBe(0);
  });

  it("parses a generic clock payload without vendor-specific schemas", () => {
    const punches = parseClockPunches({
      punches: [{ employeeNumber: "E-1", workDate: "2026-08-01", checkIn: "08:00", checkOut: "17:00" }],
    });
    expect(punches).toHaveLength(1);
    expect(punches[0].employeeNumber).toBe("E-1");
  });

  it("hides disciplinary files from the employee and from view-only roles", () => {
    const docs = [{ type: "CV" }, { type: "DISCIPLINARY" }];
    expect(visibleEmployeeDocuments(docs, { isSelf: true, canManageDocs: false })).toEqual([{ type: "CV" }]);
    expect(visibleEmployeeDocuments(docs, { isSelf: false, canManageDocs: false, canView: true })).toEqual([{ type: "CV" }]);
    expect(visibleEmployeeDocuments(docs, { isSelf: true, canManageDocs: true })).toHaveLength(2);
  });
});

describe("payroll configuration", () => {
  it("does not invent statutory percents from empty rules", () => {
    expect(parsePayrollRules(null).employeeTaxPercent).toBeUndefined();
    expect(EMPTY_PAYROLL_RULES.employeeTaxPercent).toBe(0);
  });
});

describe("amount in words", () => {
  it("describes rand amounts for receipts", () => {
    expect(amountInWordsZar(1500)).toContain("rand");
    expect(amountInWordsZar(0)).toBe("zero rand");
  });
});

describe("charge reversal and allocations", () => {
  it("credits only the unpaid remainder of a charge", () => {
    expect(
      chargeOutstanding(1200, [{ amountPaid: 400 }, { amountPaid: 0 }])
    ).toBe(800);
    expect(unpaidInstalmentIds([
      { id: "a", amountPaid: 400 },
      { id: "b", amountPaid: 0 },
    ])).toEqual(["b"]);
  });

  it("rejects instalment allocations that exceed the payment", () => {
    const tooMuch = selectedAllocations(
      [
        { instalmentId: "1", amount: 600 },
        { instalmentId: "2", amount: 500 },
      ],
      1000
    );
    expect(tooMuch.ok).toBe(false);
    const ok = selectedAllocations([{ instalmentId: "1", amount: 250 }], 500);
    expect(ok).toEqual({ ok: true, allocations: [{ instalmentId: "1", amount: 250 }] });
    expect(selectedAllocations([{ instalmentId: "1", amount: 0 }], 500)).toEqual({
      ok: true,
      allocations: [],
    });
  });
});

describe("collections and payroll reversal", () => {
  it("does not treat reversed receipts or audit reversals as collections", () => {
    expect(isCollectedPayment({ reversedAt: null, reversalOfId: null })).toBe(true);
    expect(isCollectedPayment({ reversedAt: new Date(), reversalOfId: null })).toBe(false);
    expect(isCollectedPayment({ reversedAt: null, reversalOfId: "pay-1" })).toBe(false);
  });

  it("posts payroll reversal as a negative expense so reports net down", () => {
    expect(reversingLedgerAmount(18500)).toBe(-18500);
    expect(reversingLedgerAmount(-250)).toBe(-250);
  });
});

describe("payroll payment listing", () => {
  it("exports net pay with bank last4 only, never a full account number", () => {
    const csv = payrollListingCsv([
      {
        netPay: 18500.5,
        employee: {
          employeeNumber: "E-1",
          firstName: "Ada",
          lastName: "Molefe",
          department: "Science",
          bankName: "FNB",
          bankAccountLast4: "1234",
          bankAccountEnc: "FULL-ACCOUNT-CIPHER",
        } as Parameters<typeof payrollListingCsv>[0][number]["employee"] & { bankAccountEnc: string },
      },
    ]);
    expect([...PAYROLL_LISTING_HEADERS]).toEqual([
      "Employee number",
      "Name",
      "Department",
      "Net pay",
      "Bank",
      "Account last 4",
    ]);
    expect(csv).toContain("E-1");
    expect(csv).toContain("Ada Molefe");
    expect(csv).toContain("18500.50");
    expect(csv).toContain("1234");
    expect(csv).not.toContain("FULL-ACCOUNT-CIPHER");
    expect(csv.toLowerCase()).not.toContain("account number");
    expect(csv).not.toContain("bankAccountEnc");

    const rows = payrollListingRows([
      {
        netPay: 100,
        employee: {
          employeeNumber: "E-2",
          firstName: "Thabo",
          lastName: "Dlamini",
          department: null,
          bankName: null,
          bankAccountLast4: null,
        },
      },
    ]);
    expect(Object.keys(rows[0])).toEqual([
      "employeeNumber",
      "name",
      "department",
      "netPay",
      "bankName",
      "bankAccountLast4",
    ]);
    expect(rows[0]).not.toHaveProperty("bankAccountEnc");
  });
});

describe("application enrolment matching", () => {
  it("matches grade and course names without inventing unmatched records", () => {
    const grades = [
      { id: "g10", name: "Grade 10" },
      { id: "g11", name: "11" },
    ];
    expect(matchGradeId(grades, "Grade 10")).toBe("g10");
    expect(matchGradeId(grades, "10")).toBe("g10");
    expect(matchGradeId(grades, "Grade 11")).toBe("g11");
    expect(matchGradeId(grades, "Grade 12")).toBeNull();
    expect(matchGradeId(grades, "")).toBeNull();

    const courses = [
      { id: "c1", code: "BSC-CS", name: "BSc Computer Science" },
    ];
    expect(matchCourseId(courses, "BSC-CS")).toBe("c1");
    expect(matchCourseId(courses, "BSc Computer Science")).toBe("c1");
    expect(matchCourseId(courses, "Law")).toBeNull();
  });

  it("enrols a student only the first time an application is accepted", () => {
    expect(shouldCreateStudentOnAccept({ nextStatus: "ACCEPTED", studentId: null })).toBe(true);
    expect(shouldCreateStudentOnAccept({ nextStatus: "ACCEPTED", studentId: "stu-1" })).toBe(false);
    expect(shouldCreateStudentOnAccept({ nextStatus: "REJECTED", studentId: null })).toBe(false);
    expect(shouldCreateStudentOnAccept({ nextStatus: "UNDER_REVIEW", studentId: null })).toBe(false);
  });
});

describe("finance slips", () => {
  it("only accepts PDF and image slips", async () => {
    expect(FINANCE_SLIP_TYPES).toEqual(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
    const file = new File(["not-a-slip"], "virus.exe", { type: "application/x-msdownload" });
    await expect(saveFinanceSlip("sch-1", "income", file)).rejects.toThrow(/PDF or image/);
  });
});

describe("finance ops exports", () => {
  const report: FinanceOpsReport = {
    cards: {
      feesRaised: 1000,
      collected: 400,
      outstanding: 600,
      overdue: 0,
      totalIncome: 400,
      totalExpenses: 50,
      netPosition: 350,
      collectionRate: 0.4,
    },
    byMethod: { EFT: 250, CASH: 150 },
    revenueByGrade: {},
    revenueByCourse: {},
    revenueByModule: {},
    expensesByCategory: { Utilities: 50 },
    monthly: { "2026-08": { income: 0, expenses: 50, collections: 400 } },
    debtors: [
      {
        invoiceId: "inv-1",
        invoiceNumber: "INV-1",
        student: "Ada Molefe",
        studentNumber: "STD20260001",
        outstanding: 600,
        status: "SENT",
        dueDate: new Date("2026-08-31T00:00:00Z"),
      },
    ],
  };

  it("exports debtors and collections without inventing extra columns", () => {
    const debtors = financeOpsSectionCsv("debtors", report)!;
    expect(debtors).toContain("STD20260001");
    expect(debtors).toContain("600.00");
    expect(debtors.split("\n")[0]).toBe("Student number,Student,Invoice,Outstanding,Status,Due date");
    const methods = financeOpsSectionCsv("methods", report)!;
    expect(methods).toContain("CASH");
    expect(methods).toContain("150.00");
    expect(financeOpsSectionCsv("unknown", report)).toBeNull();
  });
});
