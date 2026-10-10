import { roundMoney } from "./money";
import { monthlyEmployeesTax, statutoryVersionFor } from "./za-statutory";

export interface PayrollRules {
  jurisdiction?: string;
  /** FLAT keeps the saved percent. SARS_TABLE uses the dated statutory table for the pay period. */
  payeMethod?: "FLAT" | "SARS_TABLE" | string;
  /** People covered by a medical scheme. Used only when payeMethod is SARS_TABLE. */
  medicalSchemeMembers?: number;
  employeeTaxPercent?: number;
  uifEmployeePercent?: number;
  uifEmployerPercent?: number;
  pensionEmployeePercent?: number;
  pensionEmployerPercent?: number;
  medicalEmployeePercent?: number;
  sdlEmployerPercent?: number;
  /** When set, UIF is calculated only on earnings up to this monthly amount. */
  uifMonthlyCeiling?: number;
  [key: string]: unknown;
}

export interface SalaryInput {
  payType: "MONTHLY" | "HOURLY";
  baseSalary: number;
  hourlyRate?: number | null;
  hoursWorked?: number;
  overtimeHours?: number;
  overtimeMultiplier?: number;
  allowances?: Array<{ name: string; amount: number }>;
  bonuses?: Array<{ name: string; amount: number }>;
  reimbursements?: Array<{ name: string; amount: number }>;
  extraDeductions?: Array<{ name: string; amount: number }>;
  dateOfBirth?: Date | string | null;
  periodEnd?: Date | string | null;
}

export interface PayrollLine {
  name: string;
  amount: number;
}

export interface PayrollCalculation {
  earnings: PayrollLine[];
  deductions: PayrollLine[];
  employer: PayrollLine[];
  grossPay: number;
  totalDeductions: number;
  employerContributions: number;
  netPay: number;
  exceptionNote?: string;
}

function pct(amount: number, percent: number | undefined): number {
  if (!percent || percent <= 0) return 0;
  return roundMoney((amount * percent) / 100);
}

function sumLines(lines: PayrollLine[]): number {
  return roundMoney(lines.reduce((s, l) => s + l.amount, 0));
}

export function namedMoneyLines(json: unknown): PayrollLine[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const rec = row as { name?: unknown; amount?: unknown };
      const name = String(rec.name ?? "").trim();
      const amount = roundMoney(Number(rec.amount ?? 0));
      if (!name || !amount) return null;
      return { name, amount };
    })
    .filter((row): row is PayrollLine => Boolean(row));
}

/** Parse "Housing: 2000" / "Staff loan 500" lines from HR salary forms. */
export function parseNamedAmountText(text: string | null | undefined): PayrollLine[] {
  if (!text?.trim()) return [];
  const lines: PayrollLine[] = [];
  for (const raw of text.split(/\n|,/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(.+?)(?:\s*[:=]\s*|\s+)(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) continue;
    const amount = roundMoney(Number(match[2]));
    const name = match[1].trim().replace(/[:：]\s*$/, "");
    if (!name || !amount) continue;
    lines.push({ name, amount });
  }
  return lines;
}

export function namedAmountText(lines: PayrollLine[]): string {
  return lines.map((row) => `${row.name}: ${row.amount}`).join("\n");
}

/** Pure payroll calculation. Statutory rates come from versioned rulesJson only. */
export function calculateEmployeePay(input: SalaryInput, rules: PayrollRules = {}): PayrollCalculation {
  const earnings: PayrollLine[] = [];
  if (input.payType === "HOURLY") {
    const rate = input.hourlyRate ?? 0;
    const hours = input.hoursWorked ?? 0;
    earnings.push({ name: "Hourly wages", amount: roundMoney(rate * hours) });
    if ((input.overtimeHours ?? 0) > 0) {
      const mult = input.overtimeMultiplier ?? 1.5;
      earnings.push({
        name: "Overtime",
        amount: roundMoney(rate * (input.overtimeHours ?? 0) * mult),
      });
    }
  } else {
    earnings.push({ name: "Basic salary", amount: roundMoney(input.baseSalary) });
    if ((input.overtimeHours ?? 0) > 0 && input.hourlyRate) {
      const mult = input.overtimeMultiplier ?? 1.5;
      earnings.push({
        name: "Overtime",
        amount: roundMoney(input.hourlyRate * (input.overtimeHours ?? 0) * mult),
      });
    }
  }

  for (const row of input.allowances ?? []) {
    if (row.amount) earnings.push({ name: row.name, amount: roundMoney(row.amount) });
  }
  for (const row of input.bonuses ?? []) {
    if (row.amount) earnings.push({ name: row.name, amount: roundMoney(row.amount) });
  }
  for (const row of input.reimbursements ?? []) {
    if (row.amount) earnings.push({ name: row.name, amount: roundMoney(row.amount) });
  }

  const grossPay = sumLines(earnings);
  const jurisdiction = String(rules.jurisdiction ?? "ZA").toUpperCase();
  const useSarsTable = String(rules.payeMethod ?? "FLAT").toUpperCase() === "SARS_TABLE" && jurisdiction.startsWith("ZA");
  const periodEnd = input.periodEnd ? new Date(input.periodEnd) : new Date();
  const statutory = useSarsTable ? statutoryVersionFor(periodEnd) : null;
  let tableNote: string | undefined;
  let tax = 0;
  if (statutory) {
    const employeesTax = monthlyEmployeesTax({
      version: statutory,
      monthlyGross: grossPay,
      dateOfBirth: input.dateOfBirth,
      periodEnd,
      medicalSchemeMembers: Number(rules.medicalSchemeMembers ?? 0),
    });
    tax = employeesTax.monthlyPaye;
    if (employeesTax.primaryRebateOnly) {
      tableNote = "Date of birth is missing, so only the primary rebate was applied.";
    }
  } else {
    if (useSarsTable) {
      tableNote = "No SARS table covers this pay period, so the saved flat tax percent was used.";
    }
    tax = pct(grossPay, rules.employeeTaxPercent);
  }
  const uifEmployeePercent = statutory ? statutory.uifEmployeePercent : rules.uifEmployeePercent;
  const uifEmployerPercent = statutory ? statutory.uifEmployerPercent : rules.uifEmployerPercent;
  const uifCeiling = statutory ? statutory.uifMonthlyCeiling : Number(rules.uifMonthlyCeiling ?? 0);
  const uifBase = uifCeiling > 0 ? Math.min(grossPay, uifCeiling) : grossPay;
  const deductions: PayrollLine[] = [];
  if (tax) deductions.push({ name: "Income tax", amount: tax });
  const uifEmp = pct(uifBase, uifEmployeePercent);
  if (uifEmp) deductions.push({ name: "UIF (employee)", amount: uifEmp });
  const pensionEmp = pct(grossPay, rules.pensionEmployeePercent);
  if (pensionEmp) deductions.push({ name: "Pension / provident", amount: pensionEmp });
  const medical = pct(grossPay, rules.medicalEmployeePercent);
  if (medical) deductions.push({ name: "Medical aid", amount: medical });
  for (const row of input.extraDeductions ?? []) {
    if (row.amount) deductions.push({ name: row.name, amount: roundMoney(row.amount) });
  }

  const employer: PayrollLine[] = [];
  const uifEr = pct(uifBase, uifEmployerPercent);
  if (uifEr) employer.push({ name: "UIF (employer)", amount: uifEr });
  const pensionEr = pct(grossPay, rules.pensionEmployerPercent);
  if (pensionEr) employer.push({ name: "Pension (employer)", amount: pensionEr });
  const sdl = pct(grossPay, rules.sdlEmployerPercent);
  if (sdl) employer.push({ name: "SDL (employer)", amount: sdl });

  const totalDeductions = sumLines(deductions);
  const employerContributions = sumLines(employer);
  const netPay = roundMoney(grossPay - totalDeductions);

  return {
    earnings,
    deductions,
    employer,
    grossPay,
    totalDeductions,
    employerContributions,
    netPay,
    exceptionNote: [tableNote, netPay < 0 ? "Net pay is negative — review salary or deductions" : undefined]
      .filter(Boolean)
      .join(" ") || undefined,
  };
}

export function parsePayrollRules(json: unknown): PayrollRules {
  if (!json || typeof json !== "object") return {};
  return json as PayrollRules;
}

export const EMPTY_PAYROLL_RULES: PayrollRules = {
  jurisdiction: "ZA",
  employeeTaxPercent: 0,
  uifEmployeePercent: 0,
  uifEmployerPercent: 0,
  pensionEmployeePercent: 0,
  pensionEmployerPercent: 0,
  medicalEmployeePercent: 0,
  sdlEmployerPercent: 0,
  uifMonthlyCeiling: 0,
};
