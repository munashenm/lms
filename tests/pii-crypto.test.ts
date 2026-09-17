import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDatabaseUrl } from "@/lib/db-url";
import { hashSaId, isEncryptedSecret, revealSaId, sealSaId } from "@/lib/pii-crypto";
import { rewriteIdentityWhere, sealIdentityData, unsealIdentityResult } from "@/lib/pii-prisma";

describe("production database TLS", () => {
  it("adds sslmode=require for remote production URLs", () => {
    expect(
      resolveDatabaseUrl("postgresql://u:p@switchyard.proxy.rlwy.net:5432/railway", "production")
    ).toContain("sslmode=require");
  });

  it("leaves local development URLs unchanged", () => {
    const local = "postgresql://postgres:postgres@localhost:5432/schoolhub";
    expect(resolveDatabaseUrl(local, "production")).toBe(local);
    expect(resolveDatabaseUrl(local, "development")).toBe(local);
  });

  it("does not downgrade an existing verify-full mode", () => {
    const url = "postgresql://u:p@db.example:5432/app?sslmode=verify-full";
    expect(resolveDatabaseUrl(url, "production")).toBe(url);
  });
});

describe("SA ID encryption at rest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores ciphertext and a keyed lookup hash", () => {
    vi.stubEnv("JWT_SECRET", "unit-test-jwt-secret-not-for-production");
    const sealed = sealSaId("800101 5009087");
    expect(sealed.stored).toBeTruthy();
    expect(isEncryptedSecret(sealed.stored!)).toBe(true);
    expect(sealed.hash).toBe(hashSaId("8001015009087"));
    expect(revealSaId(sealed.stored)).toBe("8001015009087");
  });

  it("rewrites exact ID lookups to the hash without dropping legacy plaintext rows", () => {
    vi.stubEnv("JWT_SECRET", "unit-test-jwt-secret-not-for-production");
    const where = rewriteIdentityWhere({
      schoolId: "school-a",
      saIdNumber: "8001015009087",
    }) as Record<string, unknown>;
    expect(where.schoolId).toBeUndefined();
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { schoolId: "school-a" },
        {
          OR: [
            { saIdNumberHash: hashSaId("8001015009087") },
            { saIdNumber: "8001015009087" },
          ],
        },
      ])
    );
  });

  it("seals writes and unseals reads for authorized code", () => {
    vi.stubEnv("JWT_SECRET", "unit-test-jwt-secret-not-for-production");
    const data = { firstName: "Thabo", saIdNumber: "8001015009087" };
    sealIdentityData(data);
    expect(isEncryptedSecret(data.saIdNumber)).toBe(true);
    expect(data).toHaveProperty("saIdNumberHash");
    unsealIdentityResult(data);
    expect(data.saIdNumber).toBe("8001015009087");
  });
});
