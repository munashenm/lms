import { describe, expect, it } from "vitest";
import { evaluateLicense } from "@/lib/licensing/evaluate";
import { DEFAULT_LICENSE_FEATURES } from "@/lib/licensing/features";
import type { LicenseClaims } from "@/lib/licensing/types";
import {
  classifyHttpStatus,
  classifyTransportError,
  licenseErrorCode,
  licenseRetryDelayMs,
  repeatedVerificationWarning,
  sanitizeLicenseMessage,
  shouldRetryLicenseCheck,
} from "@/lib/licensing/check-outcome";
import { isDeliverableSender, resolveSendGrid, sendGridDeliveryReady } from "@/lib/email/resolve-sendgrid";
import { appUrlUsesRailwayHostname, canonicalAppUrlWarning, publicAppUrl } from "@/lib/app-url";

function claims(): LicenseClaims {
  return {
    iss: "schoolhub-license-server",
    sub: "school-a",
    product: "lms",
    licenseKey: "SHSA-TEST-KEY",
    status: "ACTIVE",
    startsAt: "2026-06-01T00:00:00Z",
    expiresAt: "2026-12-01T00:00:00Z",
    gracePeriodDays: 7,
    limits: {
      maxLearners: 1000,
      maxEducators: 50,
      maxAdministrators: 10,
      maxCampuses: 2,
      storageLimitBytes: null,
    },
    features: DEFAULT_LICENSE_FEATURES,
  };
}

describe("licence check classification", () => {
  it("keeps HTTP errors distinct from an unreachable server", () => {
    expect(classifyHttpStatus(400).classification).toBe("HTTP_400");
    expect(classifyHttpStatus(401).classification).toBe("HTTP_401");
    expect(classifyHttpStatus(403).classification).toBe("HTTP_403");
    expect(classifyHttpStatus(404).classification).toBe("HTTP_404");
    expect(classifyHttpStatus(429).classification).toBe("HTTP_429");
    expect(classifyHttpStatus(503).classification).toBe("HTTP_5XX");
    expect(licenseErrorCode("HTTP_401")).toBe("LICENSE_HTTP_401");
    expect(licenseErrorCode("HTTP_401")).not.toBe("LICENSE_SERVER_UNAVAILABLE");
  });

  it("retries only transient failures, and only a few times", () => {
    expect(shouldRetryLicenseCheck("NETWORK", 1)).toBe(true);
    expect(shouldRetryLicenseCheck("TIMEOUT", 2)).toBe(true);
    expect(shouldRetryLicenseCheck("HTTP_429", 1)).toBe(true);
    expect(shouldRetryLicenseCheck("HTTP_5XX", 2)).toBe(true);
    expect(shouldRetryLicenseCheck("HTTP_5XX", 3)).toBe(false);
    expect(shouldRetryLicenseCheck("HTTP_400", 1)).toBe(false);
    expect(shouldRetryLicenseCheck("HTTP_401", 1)).toBe(false);
    expect(shouldRetryLicenseCheck("HTTP_403", 1)).toBe(false);
    expect(shouldRetryLicenseCheck("INVALID_SIGNATURE", 1)).toBe(false);
    expect(shouldRetryLicenseCheck("LICENSE_REJECTED", 1)).toBe(false);
    expect(licenseRetryDelayMs(0)).toBe(0);
    expect(licenseRetryDelayMs(1)).toBe(400);
    expect(licenseRetryDelayMs(1, 1)).toBe(1000);
    expect(licenseRetryDelayMs(1, 30)).toBe(400);
    expect(classifyTransportError(Object.assign(new Error("aborted"), { name: "TimeoutError" }))).toBe("TIMEOUT");
    expect(classifyTransportError(new Error("getaddrinfo ENOTFOUND"))).toBe("NETWORK");
  });

  it("does not keep licence keys in stored messages", () => {
    expect(sanitizeLicenseMessage("rejected SHSA-ABCD-EFGH-IJKL now")).toBe("rejected [redacted] now");
    expect(sanitizeLicenseMessage("Bearer secret-token")).toBe("Bearer [redacted]");
  });

  it("describes an HTTP failure without calling the server unreachable", () => {
    const evaluation = evaluateLicense({
      now: new Date("2026-06-20T00:00:00Z"),
      claims: claims(),
      signatureValid: true,
      lastVerifiedAt: new Date("2026-06-16T00:00:00Z"),
      storedStatus: "ACTIVE",
      offlineGraceDays: 14,
      serverUnavailable: true,
      contactFailure: "http",
    });
    expect(evaluation.restricted).toBe(false);
    expect(evaluation.warnings[0]).toContain("responded with an error");
    expect(evaluation.warnings[0]).not.toContain("unreachable");
  });

  it("warns Super Admin before the offline restriction", () => {
    expect(repeatedVerificationWarning("Smart School/College", 3)).toBe(
      "Licence verification warning — Smart School/College has failed verification for 3 days."
    );
  });
});

describe("SendGrid resolution", () => {
  it("uses the platform key when the school row has no key of its own", () => {
    const resolved = resolveSendGrid({
      schoolEnabled: false,
      schoolApiKey: null,
      schoolFromEmail: "noreply@schoolhub.local",
      schoolFromName: "SchoolHub SA",
      schoolReplyTo: "info@college.co.za",
      envApiKey: "SG.platform",
      envFromEmail: "noreply@schoolhubsa.co.za",
      envFromName: "SchoolHub SA",
      envReplyTo: null,
    });
    expect(resolved.source).toBe("platform");
    expect(resolved.senderValid).toBe(true);
    expect(resolved.fromEmail).toBe("noreply@schoolhubsa.co.za");
    expect(resolved.replyTo).toBe("info@college.co.za");
    expect(sendGridDeliveryReady(resolved)).toBe(true);
    expect(isDeliverableSender("noreply@schoolhub.local")).toBe(false);
  });

  it("does not send when the school turned off its own key", () => {
    const resolved = resolveSendGrid({
      schoolEnabled: false,
      schoolApiKey: "SG.school",
      schoolFromEmail: "noreply@schoolhubsa.co.za",
      schoolFromName: "School",
      schoolReplyTo: null,
      envApiKey: "SG.platform",
      envFromEmail: "noreply@schoolhubsa.co.za",
      envFromName: "SchoolHub SA",
      envReplyTo: null,
    });
    expect(resolved.source).toBe("none");
    expect(sendGridDeliveryReady(resolved)).toBe(false);
  });

  it("prefers a school key and refuses the placeholder sender", () => {
    const resolved = resolveSendGrid({
      schoolEnabled: true,
      schoolApiKey: "SG.school",
      schoolFromEmail: "noreply@schoolhub.local",
      schoolFromName: "School",
      schoolReplyTo: null,
      envApiKey: "SG.platform",
      envFromEmail: null,
      envFromName: null,
      envReplyTo: null,
    });
    expect(resolved.source).toBe("school");
    expect(resolved.senderValid).toBe(false);
    expect(sendGridDeliveryReady(resolved)).toBe(false);
  });
});

describe("canonical app URL", () => {
  it("flags the Railway hostname and leaves a custom domain alone", () => {
    expect(appUrlUsesRailwayHostname("https://lms-production-4e0d.up.railway.app")).toBe(true);
    expect(canonicalAppUrlWarning("https://app.schoolhubsa.co.za")).toBeNull();
    expect(canonicalAppUrlWarning("https://lms-production-4e0d.up.railway.app")).toContain("canonical");
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.schoolhubsa.co.za";
    expect(publicAppUrl()).toBe("https://app.schoolhubsa.co.za");
    process.env.NEXT_PUBLIC_APP_URL = previous;
  });
});
