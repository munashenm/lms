import { UserRole } from "@prisma/client";
import { hasPermission } from "./rbac";
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

export function canViewVisitorBook(role: UserRole): boolean {
  return hasPermission(role, "visitors:read");
}

export function canWriteVisitorBook(role: UserRole): boolean {
  return hasPermission(role, "visitors:write");
}

export function visitorIsOnSite(signedOutAt: Date | string | null | undefined): boolean {
  return !signedOutAt;
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
  };
}
