import { describe, expect, it } from "vitest";
import { calculateEmployeePay } from "@/lib/payroll-engine";
import { payrollConfigurationChecks, payrollFormDefaults, uifFinaliseBlockers } from "@/lib/payroll-checks";
import { statutoryVersionFor, yearOfAssessmentEnd } from "@/lib/za-statutory";

const sars = {
  jurisdiction: "ZA",
  payeMethod: "SARS_TABLE" as const,
  uifEmployeePercent: 0,
  uifEmployerPercent: 0,
  uifMonthlyCeiling: 0,
  sdlEmployerPercent: 1,
};

function pay(monthly: number, extra: { dateOfBirth?: string; periodEnd?: string; medicalSchemeMembers?: number; sdl?: number } = {}) {
  return calculateEmployeePay(
    {
      payType: "MONTHLY",
      baseSalary: monthly,
      dateOfBirth: extra.dateOfBirth,
      periodEnd: extra.periodEnd ?? "2026-10-31",
    },
    {
      ...sars,
      sdlEmployerPercent: extra.sdl ?? 1,
      medicalSchemeMembers: extra.medicalSchemeMembers ?? 0,
    }
  );
}

describe("SARS PAYE tables", () => {
  it("selects the table from the pay period", () => {
    expect(statutoryVersionFor("2026-02-28")?.id).toBe("ZA-2025-2026");
    expect(statutoryVersionFor("2026-03-01")?.id).toBe("ZA-2027");
    expect(statutoryVersionFor("2023-05-01")).toBeNull();
    expect(yearOfAssessmentEnd(new Date("2026-10-31T00:00:00.000Z")).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(yearOfAssessmentEnd(new Date("2027-01-15T00:00:00.000Z")).toISOString().slice(0, 10)).toBe("2027-02-28");
  });

  it("calculates 2027 PAYE, rebates, UIF and SDL across salary levels", () => {
    const underThreshold = pay(8000);
    expect(underThreshold.deductions.find((row) => row.name === "Income tax")).toBeUndefined();
    expect(underThreshold.deductions.find((row) => row.name === "UIF (employee)")?.amount).toBe(80);
    expect(underThreshold.netPay).toBe(7920);

    const monthly = pay(20000);
    expect(monthly.deductions.find((row) => row.name === "Income tax")?.amount).toBe(2115);
    expect(monthly.deductions.find((row) => row.name === "UIF (employee)")?.amount).toBe(177.12);
    expect(monthly.employer.find((row) => row.name === "UIF (employer)")?.amount).toBe(177.12);
    expect(monthly.employer.find((row) => row.name === "SDL (employer)")?.amount).toBe(200);
    expect(monthly.netPay).toBe(17707.88);

    expect(pay(30000).deductions.find((row) => row.name === "Income tax")?.amount).toBe(4681);
    expect(pay(200000).deductions.find((row) => row.name === "Income tax")?.amount).toBe(73595.75);
    expect(pay(8250).deductions.find((row) => row.name === "Income tax")).toBeUndefined();
  });

  it("applies the secondary and tertiary rebates from age at the end of the tax year", () => {
    expect(pay(20000, { dateOfBirth: "1962-02-28" }).deductions.find((row) => row.name === "Income tax")?.amount).toBe(1301.25);
    expect(pay(20000, { dateOfBirth: "1962-03-01" }).deductions.find((row) => row.name === "Income tax")?.amount).toBe(2115);
    expect(pay(20000, { dateOfBirth: "1952-02-28" }).deductions.find((row) => row.name === "Income tax")?.amount).toBe(1030.5);
    const missing = pay(20000);
    expect(missing.exceptionNote).toContain("primary rebate");
  });

  it("uses the 2026 tax year table before 1 March 2026 and the medical credit when members are recorded", () => {
    expect(pay(20000, { periodEnd: "2026-02-28", dateOfBirth: "1990-01-01" }).deductions.find((row) => row.name === "Income tax")?.amount).toBe(2183.08);
    expect(pay(20000, { periodEnd: "2026-03-01", dateOfBirth: "1990-01-01" }).deductions.find((row) => row.name === "Income tax")?.amount).toBe(2115);
    expect(pay(20000, { dateOfBirth: "1990-01-01", medicalSchemeMembers: 1 }).deductions.find((row) => row.name === "Income tax")?.amount).toBe(1739);
  });

  it("leaves a flat-percent rule set unchanged", () => {
    const flat = calculateEmployeePay(
      { payType: "MONTHLY", baseSalary: 10000, dateOfBirth: "1950-01-01", periodEnd: "2026-10-31" },
      { employeeTaxPercent: 10 }
    );
    expect(flat.deductions.find((row) => row.name === "Income tax")?.amount).toBe(1000);
    expect(flat.netPay).toBe(9000);
    expect(flat.exceptionNote).toBeUndefined();

    const zeros = calculateEmployeePay(
      { payType: "MONTHLY", baseSalary: 20000, periodEnd: "2026-10-31" },
      { jurisdiction: "ZA", employeeTaxPercent: 0, uifEmployeePercent: 0, uifMonthlyCeiling: 0 }
    );
    expect(zeros.deductions).toEqual([]);
    expect(zeros.netPay).toBe(20000);
  });

  it("suggests SARS tables on a blank form and does not rewrite a saved rule set", () => {
    expect(payrollFormDefaults(null).payeMethod).toBe("SARS_TABLE");
    expect(payrollFormDefaults({ employeeTaxPercent: 10, uifEmployeePercent: 0 })).toEqual({
      employeeTaxPercent: 10,
      uifEmployeePercent: 0,
    });
    expect(uifFinaliseBlockers({ jurisdiction: "ZA", payeMethod: "SARS_TABLE", uifEmployeePercent: 0, uifMonthlyCeiling: 0 })).toEqual([]);
    expect(uifFinaliseBlockers({ jurisdiction: "ZA", uifEmployeePercent: 0, uifEmployerPercent: 0, uifMonthlyCeiling: 0 }).length).toBeGreaterThan(0);
    expect(
      payrollConfigurationChecks({ jurisdiction: "ZA", payeMethod: "SARS_TABLE", uifEmployeePercent: 1, uifEmployerPercent: 1, uifMonthlyCeiling: 17712, sdlEmployerPercent: 1 }).some(
        (check) => check.level === "ok" && check.message.includes("SARS table")
      )
    ).toBe(true);
  });

  it("can omit SDL when the school is under the annual exemption", () => {
    const result = pay(20000, { dateOfBirth: "1990-01-01", sdl: 0 });
    expect(result.employer.find((row) => row.name.startsWith("SDL"))).toBeUndefined();
    expect(result.deductions.find((row) => row.name === "Income tax")?.amount).toBe(2115);
  });
});
