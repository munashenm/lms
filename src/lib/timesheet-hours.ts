import { roundMoney } from "./money";

export interface TimesheetHourLine {
  hours: number | string;
  overtimeHours?: number | string | null;
}

export function sumTimesheetHours(entries: TimesheetHourLine[]): {
  totalHours: number;
  overtimeHours: number;
} {
  let total = 0;
  let overtime = 0;
  for (const row of entries) {
    total = roundMoney(total + Number(row.hours || 0));
    overtime = roundMoney(overtime + Number(row.overtimeHours || 0));
  }
  return { totalHours: total, overtimeHours: overtime };
}

export function visibleEmployeeDocuments<T extends { type: string }>(
  documents: T[],
  opts: { isSelf: boolean; canManageDocs: boolean; canView?: boolean }
): T[] {
  if (opts.canManageDocs) return documents;
  if (opts.isSelf || opts.canView) return documents.filter((d) => d.type !== "DISCIPLINARY");
  return [];
}
