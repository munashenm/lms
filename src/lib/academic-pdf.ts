import { asInputJson } from "./json";
import { generateCertificatePdf, type CertificatePdfData } from "./pdf-certificate";
import { generateLetterPdf, type LetterPdfData } from "./pdf-letter";
import { generateReportCardPdf, type ReportCardData } from "./pdf-report-card";
import { generateTranscriptPdf, type TranscriptPdfData } from "./pdf-transcript";
import { parseAcademicPdfUrl, readAcademicPdf, writeAcademicPdf } from "./pdf-response";

export type AcademicPdfSnapshot =
  | { kind: "report"; data: ReportCardData }
  | { kind: "certificate"; data: CertificatePdfData }
  | { kind: "letter"; data: LetterPdfData }
  | { kind: "transcript"; data: TranscriptPdfData };

export function academicPdfSnapshotInput(snapshot: AcademicPdfSnapshot) {
  return asInputJson(snapshot);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseAcademicPdfSnapshot(value: unknown): AcademicPdfSnapshot | null {
  if (!isRecord(value) || typeof value.kind !== "string" || !isRecord(value.data)) return null;
  if (value.kind === "report" || value.kind === "certificate" || value.kind === "letter" || value.kind === "transcript") {
    return value as AcademicPdfSnapshot;
  }
  return null;
}

export async function pdfBytesFromSnapshot(snapshot: AcademicPdfSnapshot): Promise<Uint8Array> {
  switch (snapshot.kind) {
    case "report":
      return generateReportCardPdf(snapshot.data);
    case "certificate":
      return generateCertificatePdf(snapshot.data);
    case "letter":
      return generateLetterPdf(snapshot.data);
    case "transcript":
      return generateTranscriptPdf(snapshot.data);
  }
}

export async function resolveAcademicPdf(opts: {
  pdfUrl: string | null | undefined;
  snapshot: unknown;
}): Promise<Buffer | null> {
  const existing = await readAcademicPdf(opts.pdfUrl);
  if (existing) return existing;

  const snapshot = parseAcademicPdfSnapshot(opts.snapshot);
  if (!snapshot) return null;
  try {
    const rebuilt = Buffer.from(await pdfBytesFromSnapshot(snapshot));
    const parsed = parseAcademicPdfUrl(opts.pdfUrl);
    if (parsed) {
      try {
        await writeAcademicPdf(parsed.kind, parsed.filename, rebuilt);
      } catch (err) {
        console.error("[academic-pdf] rewrite after rebuild failed", err);
      }
    }
    return rebuilt;
  } catch (err) {
    console.error("[academic-pdf] rebuild from snapshot failed", err);
    return null;
  }
}
