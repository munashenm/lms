import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { outstandingCentsFromInvoices, feesHoldMessage, isLearnerPortalRole, documentReleaseFrom, summarizeDocumentReleases } from "@/lib/fee-clearance";
import { defaultLetterBody, wrapPdfLines } from "@/lib/pdf-letter";
import { schoolSettingsSchema, issuedLetterSchema } from "@/lib/validators";
import { readPublicPdf } from "@/lib/pdf-response";
import { UserRole } from "@prisma/client";
import { academicDocumentNotice, shouldNotifyDocumentsReleased } from "@/lib/academic-document-notice";

describe("fee clearance for academic documents", () => {
  it("sums outstanding cents on collectable invoices", () => {
    expect(
      outstandingCentsFromInvoices([
        { total: "1500.00", amountPaid: "500.00" },
        { total: "200.50", amountPaid: "200.50" },
        { total: "100.00", amountPaid: "0" },
      ])
    ).toBe(110000);
  });

  it("treats a fully paid invoice as zero outstanding", () => {
    expect(outstandingCentsFromInvoices([{ total: "1200.00", amountPaid: "1200.00" }])).toBe(0);
  });

  it("does not go negative when overpaid", () => {
    expect(outstandingCentsFromInvoices([{ total: "100.00", amountPaid: "150.00" }])).toBe(0);
  });

  it("explains the hold with a rand amount", () => {
    expect(feesHoldMessage(25050)).toContain("R250.50");
  });

  it("treats only student and parent as learner portal roles", () => {
    expect(isLearnerPortalRole(UserRole.STUDENT)).toBe(true);
    expect(isLearnerPortalRole(UserRole.PARENT)).toBe(true);
    expect(isLearnerPortalRole(UserRole.TEACHER)).toBe(false);
    expect(isLearnerPortalRole(UserRole.SCHOOL_ADMIN)).toBe(false);
    expect(isLearnerPortalRole(UserRole.FINANCE_OFFICER)).toBe(false);
  });

  it("releases documents when fees are not required or outstanding is zero", () => {
    expect(documentReleaseFrom(true, 1500).released).toBe(false);
    expect(documentReleaseFrom(true, 0).released).toBe(true);
    expect(documentReleaseFrom(false, 1500).released).toBe(true);
  });

  it("summarises mixed child accounts", () => {
    const map = new Map([
      ["a", documentReleaseFrom(true, 0)],
      ["b", documentReleaseFrom(true, 25000)],
    ]);
    const summary = summarizeDocumentReleases(["a", "b"], map);
    expect(summary.releasedIds).toEqual(["a"]);
    expect(summary.blocked?.id).toBe("b");
    expect(summary.blocked?.outstandingCents).toBe(25000);
  });
});

describe("official letters", () => {
  it("writes a transfer letter that names the receiving school", () => {
    const body = defaultLetterBody({
      type: "TRANSFER",
      schoolName: "Cape Town High",
      studentName: "Anele Ndlovu",
      studentNumber: "CTH0001",
      grade: "Grade 10",
      destinationSchool: "Westville College",
      reason: "Relocation",
    });
    expect(body).toContain("Westville College");
    expect(body).toContain("Anele Ndlovu");
    expect(body).toContain("Relocation");
  });

  it("writes fee clearance, leaving and enrolment letters", () => {
    expect(
      defaultLetterBody({
        type: "FEE_CLEARANCE",
        schoolName: "Cape Town High",
        studentName: "Anele Ndlovu",
        studentNumber: "CTH0001",
      })
    ).toMatch(/paid in full/i);
    expect(
      defaultLetterBody({
        type: "LEAVING",
        schoolName: "Cape Town High",
        studentName: "Anele Ndlovu",
        studentNumber: "CTH0001",
        reason: "End of programme",
      })
    ).toContain("End of programme");
    expect(
      defaultLetterBody({
        type: "ENROLMENT",
        schoolName: "Cape Town High",
        studentName: "Anele Ndlovu",
        studentNumber: "CTH0001",
        grade: "Grade 10",
      })
    ).toMatch(/proof of enrolment/i);
  });

  it("wraps long letter lines to the page width", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapPdfLines(
      font,
      "This learner is transferring to another school after completing the academic year in good standing.",
      11,
      80
    );
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toContain("transferring");
  });
});

describe("academic pdf paths", () => {
  it("rejects path traversal", async () => {
    expect(await readPublicPdf("/uploads/../.env")).toBeNull();
    expect(await readPublicPdf("/etc/passwd")).toBeNull();
    expect(await readPublicPdf("")).toBeNull();
  });
});

describe("school settings document hold", () => {
  it("accepts the fees-paid document release flag", () => {
    expect(schoolSettingsSchema.safeParse({ requireFeesPaidForDocuments: true }).success).toBe(true);
  });

  it("accepts enrolment confirmation letters", () => {
    const parsed = issuedLetterSchema.safeParse({
      studentId: "stu_1",
      type: "ENROLMENT",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("academic document notices", () => {
  it("points families to the download when fees are clear", () => {
    const notice = academicDocumentNotice({
      kind: "report",
      title: "Term 2 report",
      released: true,
    });
    expect(notice.title).toBe("Report is ready");
    expect(notice.studentLink).toBe("/student/report-cards");
    expect(notice.parentLink).toBe("/parent/report-cards");
    expect(notice.studentMessage).toContain("available to download");
  });

  it("sends unpaid families to fees instead of the PDF", () => {
    const notice = academicDocumentNotice({
      kind: "letter",
      title: "Transfer letter",
      released: false,
    });
    expect(notice.studentLink).toBe("/student/fees");
    expect(notice.parentLink).toBe("/parent/fees");
    expect(notice.studentMessage).toMatch(/paid in full/i);
  });

  it("notifies only when an unpaid account becomes clear", () => {
    const held = documentReleaseFrom(true, 5000);
    const clear = documentReleaseFrom(true, 0);
    const off = documentReleaseFrom(false, 5000);
    expect(shouldNotifyDocumentsReleased(held, clear)).toBe(true);
    expect(shouldNotifyDocumentsReleased(clear, clear)).toBe(false);
    expect(shouldNotifyDocumentsReleased(held, held)).toBe(false);
    expect(shouldNotifyDocumentsReleased(off, documentReleaseFrom(false, 0))).toBe(false);
  });
});
