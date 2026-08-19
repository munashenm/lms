import { mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import path from "path";
import type { BackupStorageProvider, StoredObject } from "./types";

export function localBackupRoot(): string {
  const configured = process.env.BACKUP_LOCAL_PATH;
  if (configured) return configured;
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "backups");
}

export class LocalBackupStorage implements BackupStorageProvider {
  readonly name = "local";

  constructor(private readonly root: string = localBackupRoot()) {}

  private full(key: string): string {
    const safe = key.replace(/\0/g, "");
    const resolved = path.resolve(this.root, safe);
    if (!resolved.startsWith(path.resolve(this.root))) {
      throw new Error("Invalid storage key");
    }
    return resolved;
  }

  async put(key: string, body: Buffer): Promise<StoredObject> {
    const dest = this.full(key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, body);
    return { key, size: body.length };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.full(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.full(key), { force: true });
  }

  async list(prefix: string): Promise<StoredObject[]> {
    const dir = this.full(prefix);
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const out: StoredObject[] = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const rel = path.join(prefix, entry.name);
        const info = await stat(this.full(rel));
        out.push({ key: rel.replace(/\\/g, "/"), size: info.size });
      }
      return out;
    } catch {
      return [];
    }
  }
}
