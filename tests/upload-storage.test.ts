import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "fs/promises";
import os from "os";
import path from "path";

describe("upload object storage", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("namespaces put/get keys by schoolId under uploads/", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "schoolhub-uploads-"));
    try {
      vi.stubEnv("UPLOAD_STORAGE_PROVIDER", "local");
      vi.stubEnv("UPLOAD_ALLOW_LOCAL", "true");
      vi.stubEnv("NODE_ENV", "test");
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
      await mkdir(path.join(root, "public"), { recursive: true });

      const { putSchoolUpload, readUploadByPathname, resetUploadStorageCache } =
        await import("@/lib/uploads/storage");
      resetUploadStorageCache();

      const url = await putSchoolUpload({
        schoolId: "school-a",
        relativePath: "students/learner-1/id.pdf",
        body: Buffer.from("%PDF-test"),
        contentType: "application/pdf",
      });
      expect(url).toBe("/uploads/school-a/students/learner-1/id.pdf");

      const disk = path.join(root, "public", "uploads", "school-a", "students", "learner-1", "id.pdf");
      expect(await readFile(disk, "utf8")).toBe("%PDF-test");

      const loaded = await readUploadByPathname(url);
      expect(loaded?.toString("utf8")).toBe("%PDF-test");

      cwdSpy.mockRestore();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("lists school files for backup snapshots", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "schoolhub-uploads-list-"));
    try {
      vi.stubEnv("UPLOAD_STORAGE_PROVIDER", "local");
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
      const dir = path.join(root, "public", "uploads", "school-b", "branding");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "logo.png"), Buffer.from("png"));

      const { listSchoolUploadSnapshotFiles, resetUploadStorageCache } =
        await import("@/lib/uploads/storage");
      resetUploadStorageCache();
      const files = await listSchoolUploadSnapshotFiles("school-b");
      expect(files.some((f) => f.relativePath === "uploads/school-b/branding/logo.png")).toBe(true);

      cwdSpy.mockRestore();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires S3 (or local override) for production uploads", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevUpload = process.env.UPLOAD_STORAGE_PROVIDER;
    const prevBackup = process.env.BACKUP_STORAGE_PROVIDER;
    const prevAllow = process.env.UPLOAD_ALLOW_LOCAL;
    try {
      process.env.UPLOAD_STORAGE_PROVIDER = "local";
      process.env.BACKUP_STORAGE_PROVIDER = "local";
      delete process.env.UPLOAD_ALLOW_LOCAL;
      // @ts-expect-error test override
      process.env.NODE_ENV = "production";
      vi.resetModules();
      const { uploadStorageConfigurationError, resetUploadStorageCache } =
        await import("@/lib/uploads/storage");
      resetUploadStorageCache();
      expect(uploadStorageConfigurationError()).toMatch(/UPLOAD_STORAGE_PROVIDER=s3/);
      process.env.UPLOAD_ALLOW_LOCAL = "true";
      vi.resetModules();
      const mod = await import("@/lib/uploads/storage");
      mod.resetUploadStorageCache();
      expect(mod.uploadStorageConfigurationError()).toBeNull();
    } finally {
      // @ts-expect-error restore
      process.env.NODE_ENV = prevNodeEnv;
      process.env.UPLOAD_STORAGE_PROVIDER = prevUpload;
      process.env.BACKUP_STORAGE_PROVIDER = prevBackup;
      process.env.UPLOAD_ALLOW_LOCAL = prevAllow;
      vi.resetModules();
    }
  });

  it("rejects restore paths that escape uploads/", async () => {
    const { restoreUploadSnapshotFile, resetUploadStorageCache } =
      await import("@/lib/uploads/storage");
    resetUploadStorageCache();
    expect(await restoreUploadSnapshotFile("uploads/../../etc/passwd", "YQ==")).toBe(false);
  });
});
