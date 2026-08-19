import { roundMoney } from "./money";

export interface PayrollRules {
  jurisdiction?: string;
  employeeTaxPercent?: number;
  uifEmployeePercent?: number;
  uifEmployerPercent?: number;
  pensionEmployeePercent?: number;
  pensionEmployerPercent?: number;
  medicalEmployeePercent?: number;
  sdlEmployerPercent?: number;
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
  const deductions: PayrollLine[] = [];
  const tax = pct(grossPay, rules.employeeTaxPercent);
  if (tax) deductions.push({ name: "Income tax", amount: tax });
  const uifEmp = pct(grossPay, rules.uifEmployeePercent);
  if (uifEmp) deductions.push({ name: "UIF (employee)", amount: uifEmp });
  const pensionEmp = pct(grossPay, rules.pensionEmployeePercent);
  if (pensionEmp) deductions.push({ name: "Pension / provident", amount: pensionEmp });
  const medical = pct(grossPay, rules.medicalEmployeePercent);
  if (medical) deductions.push({ name: "Medical aid", amount: medical });
  for (const row of input.extraDeductions ?? []) {
    if (row.amount) deductions.push({ name: row.name, amount: roundMoney(row.amount) });
  }

  const employer: PayrollLine[] = [];
  const uifEr = pct(grossPay, rules.uifEmployerPercent);
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
    exceptionNote: netPay < 0 ? "Net pay is negative — review salary or deductions" : undefined,
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
};
