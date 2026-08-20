import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { outstandingCentsFromInvoices, feesHoldMessage, isLearnerPortalRole } from "@/lib/fee-clearance";
import { defaultLetterBody, wrapPdfLines } from "@/lib/pdf-letter";
import { schoolSettingsSchema } from "@/lib/validators";
import { readPublicPdf } from "@/lib/pdf-response";
import { UserRole } from "@prisma/client";

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

  it("writes fee clearance and leaving letters", () => {
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
    const parsed = schoolSettingsSchema.safeParse({ requireFeesPaidForDocuments: true });
    expect(parsed.success).toBe(true);
  });
});
