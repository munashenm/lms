import type { ParsedSource, SASamsImporter } from "./types";

/**
 * Placeholder for a version-accurate SA-SAMS native database adapter.
 *
 * Do not invent Access/SQL table names, column names, or backup layouts here.
 * When an authorised anonymised sample arrives, implement parse() against that
 * sample only and keep mapping through the existing LMS staging pipeline.
 */
export const NATIVE_DATABASE_ADAPTER_ID = "sa-sams-native-db-placeholder";

export const NATIVE_DATABASE_EXTENSIONS = [".mdb", ".accdb", ".bak"] as const;

export const NATIVE_DATABASE_PLACEHOLDER_MESSAGE =
  "Native SA-SAMS database import is a placeholder until an authorised sample is received. CSV, TSV, JSON and Excel (.xlsx) exports can be imported now. The database file was not parsed, and no unpublished SA-SAMS table names have been assumed.";

export function nativeDatabasePlaceholderStatus() {
  return {
    ok: false,
    pendingSample: true,
    adapterId: NATIVE_DATABASE_ADAPTER_ID,
    acceptedExtensions: [...NATIVE_DATABASE_EXTENSIONS],
    message: NATIVE_DATABASE_PLACEHOLDER_MESSAGE,
  };
}

export function isNativeDatabaseFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return NATIVE_DATABASE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function looksLikeAccessDatabase(bytes: Buffer): boolean {
  if (bytes.length < 20) return false;
  const header = bytes.subarray(4, 19).toString("ascii");
  return header.startsWith("Standard Jet DB") || header.startsWith("Standard ACE DB");
}

export const nativeDatabaseImporter: SASamsImporter = {
  id: NATIVE_DATABASE_ADAPTER_ID,
  label: "SA-SAMS native database (placeholder)",
  versions: ["pending-authorised-sample"],
  detect(filename, _mime, bytes) {
    if (isNativeDatabaseFilename(filename)) return 95;
    if (looksLikeAccessDatabase(bytes)) return 90;
    return 0;
  },
  async parse(): Promise<ParsedSource> {
    throw new Error(NATIVE_DATABASE_PLACEHOLDER_MESSAGE);
  },
};
