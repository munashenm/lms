import { describe, expect, it } from "vitest";
import {
  academicObjectKey,
  academicPdfFilename,
  parseAcademicPdfUrl,
  readPublicPdf,
} from "@/lib/pdf-response";
import { parseAcademicPdfSnapshot, pdfBytesFromSnapshot } from "@/lib/academic-pdf";
import { reportCardBatchSkipReason, subjectRowsFromMarks } from "@/lib/issue-report-card";
import { reportCardBatchSchema } from "@/lib/validators";
import { SCHEMA_VERSION } from "@/lib/backup/snapshot";

describe("academic PDF storage keys", () => {
  it("accepts a plain pdf filename and builds an object key", () => {
    expect(academicPdfFilename("report-CTH0001-1.pdf")).toBe("report-CTH0001-1.pdf");
    expect(academicObjectKey("report-cards", "report-CTH0001-1.pdf")).toBe(
      "academic-pdfs/report-cards/report-CTH0001-1.pdf"
    );
  });

  it("rejects path traversal in filenames and urls", () => {
    expect(academicPdfFilename("../secret.pdf")).toBeNull();
    expect(academicPdfFilename("letters/ltr-1.pdf")).toBeNull();
    expect(academicObjectKey("letters", "../secret.pdf")).toBeNull();
    expect(parseAcademicPdfUrl("/uploads/../.env")).toBeNull();
    expect(parseAcademicPdfUrl("/uploads/report-cards/../letters/x.pdf")).toBeNull();
    expect(parseAcademicPdfUrl("/uploads/report-cards/ok.pdf")).toEqual({
      kind: "report-cards",
      filename: "ok.pdf",
    });
  });

  it("still rejects public-path traversal", async () => {
    expect(await readPublicPdf("/uploads/../.env")).toBeNull();
  });
});

describe("report card batch rules", () => {
  it("accepts a class and year", () => {
    expect(
      reportCardBatchSchema.safeParse({
        classId: "cls_1",
        academicYearId: "year_1",
      }).success
    ).toBe(true);
  });

  it("skips learners who already have a report or have no marks", () => {
    expect(reportCardBatchSkipReason({ alreadyIssued: true, hasMarks: true })).toMatch(/already issued/i);
    expect(reportCardBatchSkipReason({ alreadyIssued: false, hasMarks: false })).toMatch(/no marks/i);
    expect(reportCardBatchSkipReason({ alreadyIssued: false, hasMarks: true })).toBeNull();
  });

  it("rolls marks into subject rows", () => {
    const rows = subjectRowsFromMarks([
      {
        score: 40,
        assessment: { title: "Test", maxMarks: 50, weight: 1, subject: { name: "Mathematics" } },
      },
      {
        score: 30,
        assessment: { title: "Exam", maxMarks: 50, weight: 1, subject: { name: "Mathematics" } },
      },
    ]);
    expect(rows.subjects).toHaveLength(1);
    expect(rows.subjects[0].name).toBe("Mathematics");
    expect(rows.subjects[0].percentage).toBe(70);
    expect(rows.overallAverage).toBe(70);
  });
});

describe("academic PDF snapshots", () => {
  it("rebuilds a letter PDF from stored snapshot data", async () => {
    const snapshot = parseAcademicPdfSnapshot({
      kind: "letter",
      data: {
        brand: { name: "Cape Town High" },
        title: "Transfer letter",
        letterNo: "LTR-2026-0001",
        studentName: "Anele Ndlovu",
        studentNumber: "CTH0001",
        body: "The learner is transferring.",
        issuedAt: "20 Aug 2026",
        effectiveDate: "20 Aug 2026",
      },
    });
    expect(snapshot?.kind).toBe("letter");
    const bytes = await pdfBytesFromSnapshot(snapshot!);
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("rejects unknown snapshot kinds", () => {
    expect(parseAcademicPdfSnapshot({ kind: "invoice", data: {} })).toBeNull();
    expect(parseAcademicPdfSnapshot(null)).toBeNull();
  });

  it("bumps the backup schema version with the snapshot migration", () => {
    expect(SCHEMA_VERSION).toBe("20260820060000_academic_pdf_snapshot");
  });
});
