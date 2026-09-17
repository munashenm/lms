import { readFileSync } from "fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { DEV_JWT_FALLBACK, isWeakAuthSecret, resolveAuthSecret } from "@/lib/auth-secret";
import {
  getSessionFromRequest,
  jwtSecretBytes,
  SESSION_COOKIE_NAME,
} from "@/lib/session";
import { safeInternalPath } from "@/lib/safe-redirect";
import { consumeIdempotency, rateLimit } from "@/lib/rate-limit";
import { payFastAmountAcceptable, payFastItnSignature, verifyPayFastItnSignature } from "@/lib/payfast-itn";
import { resolveSafeUploadRestoreDest } from "@/lib/upload-restore-path";
import { validateLibraryDocument } from "@/lib/registration-docs";
import { authorizeCron } from "@/lib/cron-auth";
import { NextRequest } from "next/server";
import { isForcedPasswordPathAllowed } from "@/lib/force-password-reset";
import path from "path";

describe("authentication hardening", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses the known JWT fallback in production", () => {
    expect(isWeakAuthSecret("change-me")).toBe(true);
    expect(isWeakAuthSecret("schoolhub-dev-secret-change-in-production")).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "change-me");
    expect(() => resolveAuthSecret()).toThrow(/JWT_SECRET/);
  });

  it("allows the development fallback outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("JWT_SECRET", "");
    expect(resolveAuthSecret()).toBe(DEV_JWT_FALLBACK);
  });

  it("rejects protocol-relative login redirects", () => {
    expect(safeInternalPath("/admin/dashboard")).toBe("/admin/dashboard");
    expect(safeInternalPath("//evil.com")).toBeNull();
    expect(safeInternalPath("/\\evil.com")).toBeNull();
    expect(safeInternalPath("https://evil.com")).toBeNull();
    expect(safeInternalPath("\\evil")).toBeNull();
  });

  it("rate-limits repeated login attempts from the same key", () => {
    const key = `test-login-${Date.now()}`;
    for (let i = 0; i < 5; i += 1) {
      expect(rateLimit({ key, limit: 5, windowMs: 60_000 }).ok).toBe(true);
    }
    const blocked = rateLimit({ key, limit: 5, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("treats a double-click payment as a single idempotent consume", () => {
    const key = `pay-${Date.now()}`;
    expect(consumeIdempotency(key, 15_000)).toBe(true);
    expect(consumeIdempotency(key, 15_000)).toBe(false);
  });

  it("forces password reset onto the account security page only", () => {
    expect(isForcedPasswordPathAllowed("/account/password")).toBe(true);
    expect(isForcedPasswordPathAllowed("/api/auth/change-password")).toBe(true);
    expect(isForcedPasswordPathAllowed("/admin/finance")).toBe(false);
    expect(isForcedPasswordPathAllowed("/api/payments")).toBe(false);
  });

  it("reads a session JWT from the cookie header without loading prisma", async () => {
    vi.stubEnv("JWT_SECRET", "unit-test-jwt-secret-not-for-production");
    const token = await new SignJWT({
      userId: "user-1",
      email: "admin@example.com",
      role: "SCHOOL_ADMIN",
      schoolId: "school-1",
      firstName: "Ada",
      lastName: "Admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(jwtSecretBytes());

    const session = await getSessionFromRequest(`${SESSION_COOKIE_NAME}=${token}`);
    expect(session?.userId).toBe("user-1");
    expect(session?.schoolId).toBe("school-1");
    expect(await getSessionFromRequest(null)).toBeNull();
  });

  it("keeps Edge middleware and client timetable forms off Node crypto", () => {
    const middleware = readFileSync("src/middleware.ts", "utf8");
    expect(middleware).not.toMatch(/from ["']@\/lib\/auth["']/);
    expect(middleware).toMatch(/from ["']@\/lib\/session["']/);

    const session = readFileSync("src/lib/session.ts", "utf8");
    expect(session).not.toMatch(/from ["']\.\/db["']/);
    expect(session).not.toMatch(/from ["']crypto["']/);

    const days = readFileSync("src/lib/timetable-days.ts", "utf8");
    expect(days).not.toMatch(/from ["']\.\/db["']/);

    const form = readFileSync("src/components/academics/timetable-form.tsx", "utf8");
    expect(form).not.toMatch(/from ["']@\/lib\/portal-data["']/);
    expect(form).toMatch(/from ["']@\/lib\/timetable-days["']/);
  });
});

describe("PayFast ITN", () => {
  it("accepts a matching signature and rejects tampering", () => {
    const fields = {
      merchant_id: "10000100",
      m_payment_id: "inv_1",
      payment_status: "COMPLETE",
      amount_gross: "150.00",
    };
    const signature = payFastItnSignature(fields, "pass-phrase");
    expect(verifyPayFastItnSignature(fields, "pass-phrase", signature)).toBe(true);
    expect(verifyPayFastItnSignature({ ...fields, amount_gross: "9999.00" }, "pass-phrase", signature)).toBe(false);
  });

  it("rejects ITN amounts above the outstanding balance", () => {
    expect(payFastAmountAcceptable(100, 100)).toBe(true);
    expect(payFastAmountAcceptable(100.01, 100)).toBe(true);
    expect(payFastAmountAcceptable(200, 100)).toBe(false);
    expect(payFastAmountAcceptable(0, 100)).toBe(false);
  });
});

describe("file restore and uploads", () => {
  it("jails restore paths inside public/uploads", () => {
    const cwd = "/workspace";
    expect(resolveSafeUploadRestoreDest("uploads/school-a/file.pdf", cwd)).toBe(
      path.resolve(cwd, "public/uploads/school-a/file.pdf")
    );
    expect(resolveSafeUploadRestoreDest("uploads/../secret.txt", cwd)).toBeNull();
    expect(resolveSafeUploadRestoreDest("uploads/school-a/../../etc/passwd", cwd)).toBeNull();
    expect(resolveSafeUploadRestoreDest("/etc/passwd", cwd)).toBeNull();
  });

  it("rejects executable document uploads", () => {
    expect(validateLibraryDocument({ name: "id.pdf", size: 1000, type: "application/pdf" })).toBeNull();
    expect(validateLibraryDocument({ name: "payload.exe", size: 1000, type: "application/octet-stream" })).toBeTruthy();
    expect(validateLibraryDocument({ name: "note.html", size: 1000, type: "text/html" })).toBeTruthy();
    expect(validateLibraryDocument({ name: "huge.pdf", size: 20 * 1024 * 1024, type: "application/pdf" })).toBeTruthy();
  });
});

describe("cron authentication", () => {
  it("does not accept the secret as a query parameter", () => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    const query = new NextRequest("https://lms.example/api/cron/backups?secret=cron-test-secret");
    expect(authorizeCron(query)).toBe(false);
    const header = new NextRequest("https://lms.example/api/cron/backups", {
      headers: { authorization: "Bearer cron-test-secret" },
    });
    expect(authorizeCron(header)).toBe(true);
  });
});
