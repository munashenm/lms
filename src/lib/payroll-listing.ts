import { toCsv } from "./csv";

export const PAYROLL_LISTING_HEADERS = [
  "Employee number",
  "Name",
  "Department",
  "Net pay",
  "Bank",
  "Account last 4",
] as const;

export type PayrollListingItem = {
  netPay: unknown;
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
    department: string | null;
    bankName: string | null;
    bankAccountLast4: string | null;
  };
};

export type PayrollListingRow = {
  employeeNumber: string;
  name: string;
  department: string;
  netPay: number;
  bankName: string;
  bankAccountLast4: string;
};

/** Safe bank-file columns. Full account numbers and ciphertext are never included. */
export function payrollListingRows(items: PayrollListingItem[]): PayrollListingRow[] {
  return items.map((item) => ({
    employeeNumber: item.employee.employeeNumber,
    name: `${item.employee.firstName} ${item.employee.lastName}`.trim(),
    department: item.employee.department ?? "",
    netPay: Number(item.netPay),
    bankName: item.employee.bankName ?? "",
    bankAccountLast4: item.employee.bankAccountLast4 ?? "",
  }));
}

export function payrollListingCsv(items: PayrollListingItem[]): string {
  const rows = payrollListingRows(items);
  return toCsv(
    [...PAYROLL_LISTING_HEADERS],
    rows.map((row) => [
      row.employeeNumber,
      row.name,
      row.department,
      row.netPay.toFixed(2),
      row.bankName,
      row.bankAccountLast4,
    ])
  );
}
