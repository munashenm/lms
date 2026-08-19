import { csvImporter } from "./csv";
import { jsonImporter } from "./json";
import { xlsxImporter } from "./xlsx";
import { nativeDatabaseImporter } from "./native-database";
import type { SASamsImporter } from "./types";

export const IMPORTERS: SASamsImporter[] = [csvImporter, jsonImporter, xlsxImporter, nativeDatabaseImporter];

export function detectImporter(
  filename: string,
  mimeType: string | null,
  bytes: Buffer
): { importer: SASamsImporter | null; score: number; reason?: string } {
  let best: SASamsImporter | null = null;
  let score = 0;
  for (const importer of IMPORTERS) {
    const next = importer.detect(filename, mimeType, bytes);
    if (next > score) {
      best = importer;
      score = next;
    }
  }
  if (!best || score < 20) {
    return {
      importer: null,
      score,
      reason:
        "Unsupported file format. Upload a CSV, TSV, JSON, Excel (.xlsx), or a native SA-SAMS database file (.mdb, .accdb, .bak). Native database parsing is a placeholder until an authorised sample is received.",
    };
  }
  return { importer: best, score };
}
