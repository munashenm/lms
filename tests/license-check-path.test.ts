import { describe, expect, it } from "vitest";
import { isPublicLicenseCheck } from "@/lib/licensing/public-check";

describe("public licence check", () => {
  it("allows only the unauthenticated POST heartbeat", () => {
    expect(isPublicLicenseCheck("/api/license-server/v1/licenses/check", "POST")).toBe(true);
    expect(isPublicLicenseCheck("/api/license-server/v1/licenses/check", "post")).toBe(true);
    expect(isPublicLicenseCheck("/api/license-server/v1/licenses/check", "GET")).toBe(false);
    expect(isPublicLicenseCheck("/api/license-server/v1/licenses", "POST")).toBe(false);
    expect(isPublicLicenseCheck("/api/license-server/v1/licenses/check/extra", "POST")).toBe(false);
  });
});
