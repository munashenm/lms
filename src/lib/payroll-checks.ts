import type { PayrollRules } from "./payroll-engine";

/** Monthly UIF earnings ceiling (1% each side applies only up to this amount). */
export const ZA_UIF_MONTHLY_CEILING = 17712;

export interface PayrollCheck {
  level: "ok" | "warning";
  message: string;
}

/** Blank form suggestions. A saved rule set, including a stored zero, is returned unchanged. */
export function payrollFormDefaults(saved: PayrollRules | null | undefined): PayrollRules {
  if (saved) return saved;
  return {
    jurisdiction: "ZA",
    payeMethod: "SARS_TABLE",
    medicalSchemeMembers: 0,
    employeeTaxPercent: 0,
    uifEmployeePercent: 1,
    uifEmployerPercent: 1,
    pensionEmployeePercent: 0,
    pensionEmployerPercent: 0,
    medicalEmployeePercent: 0,
    sdlEmployerPercent: 0,
    uifMonthlyCeiling: ZA_UIF_MONTHLY_CEILING,
  };
}

/** Reasons a ZA payroll run must not be finalised. Warnings stay on the rules form. */
export function uifFinaliseBlockers(rules: PayrollRules): string[] {
  const jurisdiction = String(rules.jurisdiction ?? "ZA").toUpperCase();
  if (!jurisdiction.startsWith("ZA")) return [];
  if (String(rules.payeMethod ?? "").toUpperCase() === "SARS_TABLE") return [];
  const blockers: string[] = [];
  const employee = Number(rules.uifEmployeePercent ?? 0);
  const employer = Number(rules.uifEmployerPercent ?? 0);
  const ceiling = Number(rules.uifMonthlyCeiling ?? 0);
  if (employee !== 1 || employer !== 1) {
    blockers.push("UIF must be 1% from the employee and 1% from the employer before this payroll can be finalised.");
  }
  if (ceiling <= 0) {
    blockers.push(
      `Set the UIF monthly ceiling to R${ZA_UIF_MONTHLY_CEILING.toLocaleString("en-ZA")} before this payroll can be finalised. Without it, UIF would be calculated on the full gross.`
    );
  }
  return blockers;
}

export function payrollConfigurationChecks(rules: PayrollRules): PayrollCheck[] {
  const jurisdiction = String(rules.jurisdiction ?? "ZA").toUpperCase();
  if (!jurisdiction.startsWith("ZA")) {
    return [{ level: "ok", message: "Statutory checks apply when the jurisdiction is ZA." }];
  }

  const checks: PayrollCheck[] = [];
  const employee = Number(rules.uifEmployeePercent ?? 0);
  const employer = Number(rules.uifEmployerPercent ?? 0);
  const ceiling = Number(rules.uifMonthlyCeiling ?? 0);
  const sdl = Number(rules.sdlEmployerPercent ?? 0);
  const tax = Number(rules.employeeTaxPercent ?? 0);

  if (employee === 0 && employer === 0) {
    checks.push({
      level: "warning",
      message: "UIF is not configured. The usual contribution is 1% from the employee and 1% from the employer.",
    });
  } else if (employee !== 1 || employer !== 1) {
    checks.push({
      level: "warning",
      message: "UIF employee and employer rates are usually both 1%.",
    });
  } else {
    checks.push({ level: "ok", message: "UIF rates are 1% employee and 1% employer." });
  }

  if ((employee > 0 || employer > 0) && ceiling <= 0) {
    checks.push({
      level: "warning",
      message: `No UIF earnings ceiling is set, so UIF is calculated on the full gross. The monthly ceiling is R${ZA_UIF_MONTHLY_CEILING.toLocaleString("en-ZA")}.`,
    });
  } else if (ceiling > 0 && ceiling !== ZA_UIF_MONTHLY_CEILING) {
    checks.push({
      level: "warning",
      message: `UIF ceiling is R${ceiling.toLocaleString("en-ZA")}. Confirm it still matches the current monthly earnings ceiling of R${ZA_UIF_MONTHLY_CEILING.toLocaleString("en-ZA")}.`,
    });
  } else if (ceiling === ZA_UIF_MONTHLY_CEILING) {
    checks.push({ level: "ok", message: "UIF uses the monthly earnings ceiling." });
  }

  if (sdl !== 0 && sdl !== 1) {
    checks.push({
      level: "warning",
      message: "SDL is usually 1% of leviable payroll, or 0% when the annual payroll is R500,000 or less.",
    });
  } else if (sdl === 0) {
    checks.push({
      level: "warning",
      message: "SDL is 0%. That is correct only when the annual payroll is R500,000 or less.",
    });
  } else {
    checks.push({ level: "ok", message: "SDL employer rate is 1%." });
  }

  if (String(rules.payeMethod ?? "").toUpperCase() === "SARS_TABLE") {
    checks.push({
      level: "ok",
      message:
        "PAYE uses the SARS table for the pay period, with the primary rebate. The secondary and tertiary rebates apply when the employee is 65 or 75 at the end of the tax year.",
    });
  } else if (tax <= 0) {
    checks.push({
      level: "warning",
      message: "PAYE is not configured. A flat percent is not the SARS tax table — confirm the rate with your accountant before a pay run.",
    });
  } else {
    checks.push({
      level: "warning",
      message: "Income tax is a flat percent of gross pay. SARS PAYE uses tax tables, so confirm this rate before finalising payroll.",
    });
  }

  return checks;
}
