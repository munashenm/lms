import { roundMoney } from "./money";

/** Parse HH:MM (or HH:MM:SS) clock times into decimal hours. Overnight shifts wrap past midnight. */
export function hoursBetweenHhmm(checkIn?: string | null, checkOut?: string | null): number {
  const start = parseHhmm(checkIn);
  const end = parseHhmm(checkOut);
  if (start == null || end == null) return 0;
  let mins = end - start;
  if (mins < 0) mins += 24 * 60;
  return roundMoney(mins / 60);
}

export function overtimeHoursFromMinutes(minutes?: number | null): number {
  if (!minutes || minutes <= 0) return 0;
  return roundMoney(minutes / 60);
}

function parseHhmm(value?: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export interface ClockPunch {
  employeeNumber?: string;
  employeeId?: string;
  workDate: string;
  checkIn?: string | null;
  checkOut?: string | null;
  overtimeHours?: number | null;
  overtimeMinutes?: number | null;
  notes?: string | null;
  source?: string;
}

/** Generic JSON clock payload. Vendor-specific biometric schemas are not invented here. */
export function parseClockPunches(payload: unknown): ClockPunch[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { punches?: unknown }).punches)
      ? (payload as { punches: unknown[] }).punches
      : [];
  const punches: ClockPunch[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const workDate = String(rec.workDate ?? rec.date ?? "");
    if (!workDate) continue;
    punches.push({
      employeeNumber: rec.employeeNumber ? String(rec.employeeNumber) : undefined,
      employeeId: rec.employeeId ? String(rec.employeeId) : undefined,
      workDate,
      checkIn: rec.checkIn ? String(rec.checkIn) : null,
      checkOut: rec.checkOut ? String(rec.checkOut) : null,
      overtimeHours: rec.overtimeHours != null ? Number(rec.overtimeHours) : null,
      overtimeMinutes: rec.overtimeMinutes != null ? Number(rec.overtimeMinutes) : null,
      notes: rec.notes ? String(rec.notes) : null,
      source: rec.source ? String(rec.source) : "CLOCK",
    });
  }
  return punches;
}
