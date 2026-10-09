import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { accessCardCopy } from "@/lib/gate/card-print";
import { CR80_HEIGHT, CR80_WIDTH, generateStudentCardPdf } from "@/lib/pdf-student-card";

const brand = {
  name: "Smart School/College",
  email: "info@college.co.za",
  phone: "087 550 1813",
  address: "123 Education Drive",
  city: "Johannesburg",
  primaryColor: "#115E59",
  accentColor: "#F4C430",
};

describe("CR80 identity cards", () => {
  it("prints a learner card at PVC ID-1 size", async () => {
    const token = "SHABCDEFGHJKLMNPQR";
    const qrPng = await QRCode.toBuffer(token, { type: "png", margin: 0, width: 256, errorCorrectionLevel: "M" });
    const pdf = await generateStudentCardPdf({
      brand,
      studentName: "Thabo Mahlangu",
      studentNumber: "STU-LIVE-001",
      cardTitle: "LEARNER IDENTITY CARD",
      photoUrl: null,
      facts: [
        { label: "Learner No", value: "STU-LIVE-001" },
        { label: "Grade", value: "NQF 4" },
        { label: "Class", value: "IT-4A" },
        { label: "Valid", value: "2026" },
      ],
      scanToken: token,
      qrPng,
    });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    const size = doc.getPage(0).getSize();
    expect(size.width).toBeCloseTo(CR80_WIDTH, 2);
    expect(size.height).toBeCloseTo(CR80_HEIGHT, 2);
    expect(size.width).toBeGreaterThan(size.height);
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it("labels staff cards with employee details", () => {
    const copy = accessCardCopy({
      student: null,
      employee: {
        firstName: "Grace",
        lastName: "Dlamini",
        employeeNumber: "EMP-014",
        position: "Grounds",
        department: "Campus services",
      },
      user: null,
      validYear: "2026",
    });
    expect(copy.cardTitle).toBe("STAFF IDENTITY CARD");
    expect(copy.facts.map((fact) => fact.label)).toEqual(["Staff No", "Position", "Department", "Valid"]);
    expect(copy.photoUrl).toBeNull();
  });
});
