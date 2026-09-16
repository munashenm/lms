import { LicenseStatus } from "@prisma/client";

export const VENDOR_LICENSE_ACTIONS = ["renew", "suspend", "revoke", "reactivate"] as const;
export type VendorLicenseAction = (typeof VENDOR_LICENSE_ACTIONS)[number];

export function isVendorLicenseAction(value: string): value is VendorLicenseAction {
  return (VENDOR_LICENSE_ACTIONS as readonly string[]).includes(value);
}

export function licenseStatusAfterAction(action: VendorLicenseAction): LicenseStatus {
  switch (action) {
    case "suspend":
      return LicenseStatus.SUSPENDED;
    case "revoke":
      return LicenseStatus.REVOKED;
    case "renew":
    case "reactivate":
      return LicenseStatus.ACTIVE;
  }
}

export function nextRenewalExpiry(
  currentExpiresAt: Date | null | undefined,
  now = new Date(),
  months = 12
): Date {
  const base =
    currentExpiresAt && currentExpiresAt.getTime() > now.getTime() ? new Date(currentExpiresAt) : new Date(now);
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function heartbeatFreshness(
  lastSeenAt: Date | string | null | undefined,
  now = new Date()
): "live" | "stale" | "never" {
  if (!lastSeenAt) return "never";
  const seen = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  if (Number.isNaN(seen.getTime())) return "never";
  const hours = (now.getTime() - seen.getTime()) / 36e5;
  if (hours <= 48) return "live";
  return "stale";
}

export function latestHeartbeat(
  dates: Array<Date | string | null | undefined>
): Date | null {
  let latest: Date | null = null;
  for (const value of dates) {
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}
