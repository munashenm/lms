import { describe, expect, it } from "vitest";
import {
  checkEducatorEmis,
  checkLearnerEmis,
  summariseCompliance,
} from "@/lib/compliance/emis-fields";
import { buildSasamsExportPackage, packageToCsvBundle } from "@/lib/compliance/sasams-export";
import {
  matchLearnerForLurits,
  parseLuritsFeedback,
} from "@/lib/compliance/lurits-feedback";
import { buildCemisMarksPackage, cemisPackageToCsv } from "@/lib/compliance/cemis-export";
import { buildPromotionLuritsPackage } from "@/lib/compliance/promotion-export";
import { bucketForDays, buildDebtorsAgeAnalysis } from "@/lib/finance/debtors-age";
import { estimateMonthlyZar, PRICING_TIERS } from "@/lib/pricing";
import { assignmentStatusLabel } from "@/lib/lms-timeline";
import { canIssueOffer } from "@/lib/admissions-pipeline";

describe("EMIS compliance checks", () => {
  it("flags missing population group and gender as errors", () => {
    const issues = checkLearnerEmis({
      id: "1",
      studentNumber: "STD20260001",
      firstName: "Thabo",
      lastName: "Mokoena",
      status: "ACTIVE",
      saIdNumber: "8001015009087",
      dateOfBirth: "2010-01-15",
      gradeName: "Grade 10",
    });
    expect(issues.some((i) => i.code === "MISSING_GENDER")).toBe(true);
    expect(issues.some((i) => i.code === "MISSING_POPULATION_GROUP")).toBe(true);
    expect(summariseCompliance(issues).readyForExport).toBe(false);
  });

  it("treats complete learner as export-ready with LURITS warning only", () => {
    const issues = checkLearnerEmis({
      id: "1",
      studentNumber: "STD20260001",
      firstName: "Thabo",
      lastName: "Mokoena",
      status: "ACTIVE",
      saIdNumber: "8001015009087",
      dateOfBirth: "2010-01-15",
      gender: "MALE",
      populationGroup: "AFRICAN",
      citizenship: "South African",
      homeLanguage: "isiZulu",
      gradeName: "Grade 10",
      className: "10A",
    });
    expect(summariseCompliance(issues).blocking).toBe(false);
    expect(issues.some((i) => i.code === "MISSING_LURITS")).toBe(true);
  });

  it("checks educator SA ID", () => {
    const issues = checkEducatorEmis({
      id: "t1",
      employeeNumber: "EMP1",
      firstName: "Lerato",
      lastName: "Dlamini",
      status: "ACTIVE",
    });
    expect(issues.some((i) => i.code === "MISSING_EDUCATOR_ID")).toBe(true);
  });
});

describe("SA-SAMS export package", () => {
  it("builds learner/educator/guardian CSV bundle", () => {
    const pkg = buildSasamsExportPackage({
      school: { name: "Demo High", registrationNo: "600123", province: "Gauteng" },
      learners: [
        {
          studentNumber: "ADM001",
          firstName: "Thabo",
          lastName: "Mokoena",
          saIdNumber: "8001015009087",
          gender: "MALE",
          populationGroup: "AFRICAN",
          status: "ACTIVE",
          gradeName: "10",
          className: "10A",
          guardians: [
            {
              firstName: "Nomsa",
              lastName: "Mokoena",
              relationship: "Mother",
              isPrimary: true,
              phone: "0821234567",
            },
          ],
        },
      ],
      educators: [
        {
          employeeNumber: "E1",
          firstName: "Lerato",
          lastName: "Dlamini",
          saIdNumber: "7501015009087",
          status: "ACTIVE",
        },
      ],
      generatedAt: new Date("2026-09-29T10:00:00Z"),
    });
    const bundle = packageToCsvBundle(pkg);
    expect(bundle["learners.csv"]).toContain("Thabo");
    expect(bundle["guardians.csv"]).toContain("Nomsa");
    expect(bundle["educators.csv"]).toContain("Lerato");
    expect(bundle["manifest.json"]).toContain("Demo High");
  });
});

describe("LURITS feedback", () => {
  it("parses XML learner feedback and matches by SA ID", () => {
    const xml = `<?xml version="1.0"?>
    <Learners>
      <Learner>
        <IDNumber>8001015009087</IDNumber>
        <AdmissionNumber>ADM001</AdmissionNumber>
        <LURITSNumber>LUR123456</LURITSNumber>
        <FirstName>Thabo</FirstName>
        <Surname>Mokoena</Surname>
      </Learner>
    </Learners>`;
    const records = parseLuritsFeedback("Tx4_feedback.xml", xml);
    expect(records).toHaveLength(1);
    expect(records[0].luritsNumber).toBe("LUR123456");
    const id = matchLearnerForLurits(records[0], [
      { id: "stu1", saIdNumber: "8001015009087", studentNumber: "ADM001" },
    ]);
    expect(id).toBe("stu1");
  });

  it("parses CSV feedback", () => {
    const csv = `IDNumber,AdmissionNumber,LURITSNumber
8001015009087,ADM001,LUR999
`;
    const records = parseLuritsFeedback("Tx7.csv", csv);
    expect(records[0].luritsNumber).toBe("LUR999");
  });
});

describe("CEMIS and promotion exports", () => {
  it("builds CEMIS marks CSV", () => {
    const pkg = buildCemisMarksPackage({
      school: { name: "WC School", province: "Western Cape" },
      rows: [
        {
          studentNumber: "ADM001",
          firstName: "A",
          lastName: "B",
          subjectCode: "MATH",
          subjectName: "Mathematics",
          assessmentTitle: "Term 1 Test",
          score: 72,
          maxMarks: 100,
          gradeSymbol: "5",
        },
      ],
    });
    expect(cemisPackageToCsv(pkg)).toContain("MATH");
  });

  it("builds promotion LURITS package", () => {
    const pkg = buildPromotionLuritsPackage({
      school: { name: "Demo" },
      rows: [
        {
          studentNumber: "ADM001",
          firstName: "A",
          lastName: "B",
          fromGradeName: "10",
          toGradeName: "11",
          outcome: "PROMOTED",
        },
      ],
    });
    expect(pkg.promotions[0].toGrade).toBe("11");
  });
});

describe("Debtors age analysis", () => {
  it("buckets Current / 30 / 60 / 90 / 120+ from due dates", () => {
    expect(bucketForDays(-2)).toBe("current");
    expect(bucketForDays(10)).toBe("1_30");
    expect(bucketForDays(45)).toBe("31_60");
    expect(bucketForDays(75)).toBe("61_90");
    expect(bucketForDays(91)).toBe("120_plus");
    expect(bucketForDays(120)).toBe("120_plus");

    const asOf = new Date("2026-09-29T12:00:00Z");
    const analysis = buildDebtorsAgeAnalysis(
      [
        {
          invoiceId: "i1",
          studentId: "s1",
          outstanding: 1000,
          dueDate: "2026-09-20T00:00:00Z",
        },
        {
          invoiceId: "i2",
          studentId: "s1",
          outstanding: 500,
          dueDate: "2026-06-01T00:00:00Z",
        },
      ],
      asOf
    );
    expect(analysis.totalOutstanding).toBe(1500);
    expect(analysis.debtorAccountCount).toBe(1);
    expect(analysis.rows).toHaveLength(1);
    expect(analysis.totals["1_30"]).toBe(1000);
    expect(analysis.totals["120_plus"]).toBe(500);
  });

  it("ages only the remaining unpaid portion after partial payment", () => {
    const asOf = new Date("2026-09-29T12:00:00Z");
    const analysis = buildDebtorsAgeAnalysis(
      [
        {
          invoiceId: "i1",
          studentId: "s1",
          outstanding: 250, // R1000 invoice with R750 paid
          dueDate: "2026-07-01T00:00:00Z",
        },
        {
          invoiceId: "i2",
          studentId: "s2",
          outstanding: 0,
          dueDate: "2026-01-01T00:00:00Z",
        },
      ],
      asOf
    );
    expect(analysis.debtorAccountCount).toBe(1);
    expect(analysis.totalOutstanding).toBe(250);
    expect(analysis.totals["61_90"]).toBe(250);
    expect(analysis.totals["120_plus"]).toBe(0);
  });
});

describe("Pricing and admissions helpers", () => {
  it("publishes transparent pricing tiers", () => {
    expect(PRICING_TIERS.some((t) => t.id === "compliance")).toBe(true);
    expect(estimateMonthlyZar("professional", 100)).toBeGreaterThan(3490);
  });

  it("allows issuing offers from review stages", () => {
    expect(canIssueOffer("UNDER_REVIEW")).toBe(true);
    expect(canIssueOffer("OFFER_ISSUED")).toBe(false);
  });

  it("labels assignment statuses for LMS polish", () => {
    expect(assignmentStatusLabel({ submitted: false, graded: false, dueAt: "2020-01-01" })).toBe(
      "Overdue"
    );
    expect(assignmentStatusLabel({ submitted: true, graded: true })).toBe("Graded");
  });
});
