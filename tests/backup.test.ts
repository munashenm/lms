import { describe, expect, it } from "vitest";
import { packBackup, unpackBackup, verifyBackupIntegrity } from "@/lib/backup/package";
import { deriveBackupKey } from "@/lib/backup/crypto";
import { checkBackupCompatibility } from "@/lib/backup/compatibility";
import { BACKUP_COMPATIBILITY_VERSION, BACKUP_FORMAT_VERSION } from "@/lib/backup/types";

const key = deriveBackupKey("test-backup-secret");

function sampleManifest() {
  return {
    backupVersion: BACKUP_FORMAT_VERSION,
    compatibilityVersion: BACKUP_COMPATIBILITY_VERSION,
    applicationVersion: "0.1.0",
    schemaVersion: "test",
    institutionId: "school-a",
    institutionName: "Test School",
    createdAt: new Date().toISOString(),
    learnerCount: 2,
    userCount: 3,
    fileCount: 0,
    type: "OFFLINE" as const,
  };
}

describe("backup packages", () => {
  it("creates an encrypted package and restores the payload", () => {
    const plaintext = Buffer.from(JSON.stringify({ students: [{ id: "1" }] }), "utf8");
    const pkg = packBackup(plaintext, key, sampleManifest());
    expect(pkg.subarray(0, 9).toString("utf8")).toBe("LMSBACKUP");
    const unpacked = unpackBackup(pkg, key);
    expect(unpacked.ok).toBe(true);
    if (unpacked.ok) {
      expect(JSON.parse(unpacked.plaintext.toString("utf8")).students[0].id).toBe("1");
    }
  });

  it("detects a corrupt checksum", () => {
    const pkg = packBackup(Buffer.from("hello"), key, sampleManifest());
    pkg[pkg.length - 1] = pkg[pkg.length - 1] ^ 0xff;
    const integrity = verifyBackupIntegrity(pkg);
    expect(integrity.ok).toBe(false);
    const unpacked = unpackBackup(pkg, key);
    expect(unpacked.ok).toBe(false);
    if (!unpacked.ok) expect(unpacked.error).toBe("checksum");
  });

  it("fails decryption with the wrong key", () => {
    const pkg = packBackup(Buffer.from("secret-school-data"), key, sampleManifest());
    const unpacked = unpackBackup(pkg, deriveBackupKey("other-secret"));
    expect(unpacked.ok).toBe(false);
    if (!unpacked.ok) expect(unpacked.error).toBe("decrypt");
  });

  it("rejects incompatible backup versions", () => {
    const result = checkBackupCompatibility({
      backupVersion: 99,
      compatibilityVersion: 99,
      applicationVersion: "9.9.9",
      schemaVersion: "x",
      institutionId: "school-a",
      institutionName: "Test",
      createdAt: new Date().toISOString(),
      learnerCount: 0,
      userCount: 0,
      fileCount: 0,
      checksum: "abc",
      encryption: { alg: "aes-256-gcm", kdf: "sha256", iv: "", authTag: "" },
      type: "OFFLINE",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("does not embed cloud credentials in the snapshot contract", async () => {
    const { SECRET_BACKUP_FIELDS } = await import("@/lib/backup/types");
    expect(SECRET_BACKUP_FIELDS).toContain("sendgridApiKey");
    expect(SECRET_BACKUP_FIELDS).toContain("twilioAuthToken");
    expect(SECRET_BACKUP_FIELDS).toContain("yocoSecretKey");
  });
});
