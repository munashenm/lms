import { sessionHasPermission } from "./rbac";
import type { SessionPayload } from "./session";
import { maskIdentityNumber } from "./learner-portal";

export const VISITOR_HOST_KIND_LABELS: Record<string, string> = {
  STAFF: "Staff",
  LEARNER: "Learner",
  OTHER: "Other",
};

export const VISITOR_PURPOSE_LABELS: Record<string, string> = {
  PARENT_GUARDIAN: "Parent / guardian",
  ENROLMENT: "Admissions / enrolment",
  DELIVERY: "Delivery",
  CONTRACTOR: "Contractor / service",
  OFFICIAL: "Official / inspector",
  SPORTS_CULTURE: "Sport / culture",
  MEETING: "Meeting",
  OTHER: "Other",
};

export const VISITOR_IDENTITY_TYPE_LABELS: Record<string, string> = {
  SA_ID: "SA ID",
  PASSPORT: "Passport",
  DRIVERS_LICENCE: "Driver’s licence",
  OTHER: "Other",
};

export function canViewVisitorBook(session: SessionPayload): boolean {
  return sessionHasPermission(session, "visitors:read");
}

export function canWriteVisitorBook(session: SessionPayload): boolean {
  return sessionHasPermission(session, "visitors:write") || sessionHasPermission(session, "visitors.create");
}

export function canCheckoutVisitor(session: SessionPayload): boolean {
  return sessionHasPermission(session, "visitors:write") || sessionHasPermission(session, "visitors.checkout");
}

export const VISITOR_STATUS_LABELS: Record<string, string> = {
  EXPECTED: "Expected",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  DENIED: "Denied",
  OVERDUE: "Overdue",
};

export function effectiveVisitorStatus(row: {
  status?: string | null;
  signedOutAt?: Date | string | null;
  expectedDepartureAt?: Date | string | null;
}) {
  if (row.signedOutAt) return "CHECKED_OUT";
  if (row.status === "DENIED" || row.status === "EXPECTED") return row.status;
  if (row.expectedDepartureAt && new Date(row.expectedDepartureAt) < new Date()) return "OVERDUE";
  return row.status || "CHECKED_IN";
}

export function visitorIsOnSite(
  signedOutAt: Date | string | null | undefined,
  status?: string | null
): boolean {
  if (signedOutAt) return false;
  if (status === "EXPECTED" || status === "DENIED" || status === "CHECKED_OUT") return false;
  return true;
}

export function canSignOutVisitor(signedOutAt: Date | string | null | undefined): boolean {
  return visitorIsOnSite(signedOutAt);
}

export function publicIdentityNumber(
  identityNumber: string | null | undefined
): string | null {
  if (!identityNumber) return null;
  const trimmed = identityNumber.replace(/\s+/g, "");
  if (/^\d{13}$/.test(trimmed)) return maskIdentityNumber(trimmed);
  if (trimmed.length <= 4) return "••••";
  return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
}

export function formatVisitorDateTime(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toLocaleString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export type PublicVisitorEntry = {
  id: string;
  firstName: string;
  lastName: string;
  organisation: string | null;
  phone: string | null;
  identityType: string | null;
  identityNumber: string | null;
  hostKind: string;
  hostName: string;
  purpose: string;
  purposeDetail: string | null;
  vehicleRegistration: string | null;
  badgeNumber: string | null;
  notes: string | null;
  signedInAt: Date;
  signedOutAt: Date | null;
  campusName: string | null;
  signedInByName: string | null;
  signedOutByName: string | null;
  status?: string;
  email?: string | null;
  department?: string | null;
  itemsBrought?: string | null;
  expectedAt?: Date | null;
  expectedDepartureAt?: Date | null;
};

export function toPublicVisitorEntry(row: {
  id: string;
  firstName: string;
  lastName: string;
  organisation: string | null;
  phone: string | null;
  identityType: string | null;
  identityNumber: string | null;
  hostKind: string;
  hostName: string;
  purpose: string;
  purposeDetail: string | null;
  vehicleRegistration: string | null;
  badgeNumber: string | null;
  notes: string | null;
  signedInAt: Date;
  signedOutAt: Date | null;
  campus?: { name: string } | null;
  signedInBy?: { firstName: string; lastName: string } | null;
  signedOutBy?: { firstName: string; lastName: string } | null;
  status?: string | null;
  email?: string | null;
  department?: string | null;
  itemsBrought?: string | null;
  expectedAt?: Date | null;
  expectedDepartureAt?: Date | null;
}): PublicVisitorEntry {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    organisation: row.organisation,
    phone: row.phone,
    identityType: row.identityType,
    identityNumber: publicIdentityNumber(row.identityNumber),
    hostKind: row.hostKind,
    hostName: row.hostName,
    purpose: row.purpose,
    purposeDetail: row.purposeDetail,
    vehicleRegistration: row.vehicleRegistration,
    badgeNumber: row.badgeNumber,
    notes: row.notes,
    signedInAt: row.signedInAt,
    signedOutAt: row.signedOutAt,
    campusName: row.campus?.name ?? null,
    signedInByName: row.signedInBy
      ? `${row.signedInBy.firstName} ${row.signedInBy.lastName}`
      : null,
    signedOutByName: row.signedOutBy
      ? `${row.signedOutBy.firstName} ${row.signedOutBy.lastName}`
      : null,
    status: effectiveVisitorStatus(row),
    email: row.email ?? null,
    department: row.department ?? null,
    itemsBrought: row.itemsBrought ?? null,
    expectedAt: row.expectedAt ?? null,
    expectedDepartureAt: row.expectedDepartureAt ?? null,
  };
}

export function escapeVisitorHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export function visitorBadgeDocument(opts: {
  schoolName: string;
  visitorName: string;
  hostName: string;
  purpose: string;
  badgeNumber?: string | null;
  signedInAt: string;
}): string {
  const e = escapeVisitorHtml;
  const badge = opts.badgeNumber
    ? `<p>Badge: ${e(opts.badgeNumber)}</p>`
    : "";
  return `<!doctype html><html><head><title>Visitor badge</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #122033; }
      .badge { border: 3px solid #0f2744; padding: 20px; width: 320px; }
      .school { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #5c6570; margin: 0 0 8px; }
      h1 { font-size: 18px; margin: 0 0 12px; }
      p { margin: 4px 0; font-size: 13px; }
    </style></head><body>
    <div class="badge">
      <p class="school">${e(opts.schoolName)}</p>
      <h1>Visitor pass</h1>
      <p><strong>${e(opts.visitorName)}</strong></p>
      <p>Visiting: ${e(opts.hostName)}</p>
      <p>Purpose: ${e(opts.purpose)}</p>
      ${badge}
      <p>In: ${e(opts.signedInAt)}</p>
    </div>
    <script>window.print();</script>
    </body></html>`;
}
