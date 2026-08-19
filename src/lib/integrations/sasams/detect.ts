import { csvImporter } from "./csv";
import { jsonImporter } from "./json";
import { xlsxImporter } from "./xlsx";
import type { SASamsImporter } from "./types";

export const IMPORTERS: SASamsImporter[] = [csvImporter, jsonImporter, xlsxImporter];

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
        "Unsupported file format. Upload a CSV, TSV, JSON, or Excel (.xlsx) export authorised by the school. Native SA-SAMS database files will be added after we inspect a sample.",
    };
  }
  return { importer: best, score };
}
