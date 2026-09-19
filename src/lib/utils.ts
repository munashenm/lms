import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseDate(date: Date | string | null | undefined): Date | null {
  if (date == null || date === "") return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatZAR(amount: number | string): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(value)) return "R0.00";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date | string | null | undefined): string {
  const d = parseDate(date);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Africa/Johannesburg",
    }).format(d);
  } catch {
    return "—";
  }
}

export function formatDateTime(date: Date | string | null | undefined): string {
  const d = parseDate(date);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Africa/Johannesburg",
    }).format(d);
  } catch {
    return "—";
  }
}

export function toIsoDateInput(date: Date | string | null | undefined): string | null {
  const d = parseDate(date);
  if (!d) return null;
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

export function toIsoDateTime(date: Date | string | null | undefined): string | null {
  const d = parseDate(date);
  if (!d) return null;
  try {
    return d.toISOString();
  } catch {
    return null;
  }
}

/** `datetime-local` value in Africa/Johannesburg (schools do not use DST). */
export function johannesburgDatetimeLocalValue(date: Date | string = new Date()): string {
  const d = parseDate(date) ?? new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
