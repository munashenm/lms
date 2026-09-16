import { describe, expect, it } from "vitest";
import { LicenseStatus } from "@prisma/client";
import {
  heartbeatFreshness,
  latestHeartbeat,
  licenseStatusAfterAction,
  nextRenewalExpiry,
} from "@/lib/license-server/desk-shared";

describe("vendor licence desk", () => {
  it("maps actions onto licence status", () => {
    expect(licenseStatusAfterAction("renew")).toBe(LicenseStatus.ACTIVE);
    expect(licenseStatusAfterAction("reactivate")).toBe(LicenseStatus.ACTIVE);
    expect(licenseStatusAfterAction("suspend")).toBe(LicenseStatus.SUSPENDED);
    expect(licenseStatusAfterAction("revoke")).toBe(LicenseStatus.REVOKED);
  });

  it("renews from the later of now or the current expiry", () => {
    const now = new Date("2026-09-16T00:00:00Z");
    const fromPast = nextRenewalExpiry(new Date("2026-01-01T00:00:00Z"), now, 12);
    expect(fromPast.toISOString().startsWith("2027-09-16")).toBe(true);
    const fromFuture = nextRenewalExpiry(new Date("2027-03-01T00:00:00Z"), now, 12);
    expect(fromFuture.toISOString().startsWith("2028-03-01")).toBe(true);
  });

  it("classifies heartbeats as live, stale or never", () => {
    const now = new Date("2026-09-16T12:00:00Z");
    expect(heartbeatFreshness(null, now)).toBe("never");
    expect(heartbeatFreshness(new Date("2026-09-16T10:00:00Z"), now)).toBe("live");
    expect(heartbeatFreshness(new Date("2026-09-10T12:00:00Z"), now)).toBe("stale");
    expect(latestHeartbeat([null, "2026-09-01T00:00:00Z", "2026-09-14T00:00:00Z"])?.toISOString()).toBe(
      "2026-09-14T00:00:00.000Z"
    );
  });
});
