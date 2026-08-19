import { describe, expect, it } from "vitest";
import { csvImporter } from "@/lib/integrations/sasams/csv";
import { detectImporter } from "@/lib/integrations/sasams/detect";
import { applyMapping, autoMapHeaders } from "@/lib/integrations/sasams/mapping";
import { findDuplicateSourceRecords, validateMappedRecord } from "@/lib/integrations/sasams/validation";
import { matchExistingLearner } from "@/lib/integrations/sasams/duplicates";
import { shouldSkipStagingRecord } from "@/lib/integrations/sasams/duplicates";
import { validateUpload } from "@/lib/integrations/sasams/security";

const csv = `Learner Name,Learner Surname,Identity Number,Admission Number,Grade,Class,Date of Birth
Thabo,Mokoena,8001015009087,ADM001,10,10A,2010-01-15
Thabo,Mokoena,8001015009087,ADM001,10,10A,2010-01-15
,NoName,,ADM002,99,10A,not-a-date
`;

describe("SA-SAMS import framework", () => {
  it("imports a valid CSV learner file", async () => {
    const parsed = await csvImporter.parse(Buffer.from(csv, "utf8"), "learners.csv");
    expect(parsed.sheets[0].rows.length).toBe(3);
    const mappings = autoMapHeaders(parsed.sheets[0].headers, "learner");
    const mapped = applyMapping(parsed.sheets[0].rows[0], mappings);
    expect(mapped.firstName).toBe("Thabo");
    expect(mapped.lastName).toBe("Mokoena");
    expect(mapped.saIdNumber).toBe("8001015009087");
    expect(mapped.studentNumber).toBe("ADM001");
    const issues = validateMappedRecord("learner", mapped);
    expect(issues.some((i) => i.severity === "ERROR")).toBe(false);
  });

  it("flags invalid records as errors", () => {
    const issues = validateMappedRecord("learner", {
      firstName: "",
      lastName: "NoName",
      dateOfBirth: "not-a-date",
      grade: "not-a-real-grade-value-that-is-way-too-long-to-be-valid-xxxxxxxxxxxxxxxxxxxx",
      saIdNumber: "123",
    });
    expect(issues.some((i) => i.code === "MISSING_FIRST_NAME")).toBe(true);
    expect(issues.some((i) => i.code === "INVALID_DATE")).toBe(true);
    expect(issues.some((i) => i.code === "INVALID_ID")).toBe(true);
  });

  it("detects duplicate learners in the source file", () => {
    const records = [
      { index: 0, mapped: { saIdNumber: "8001015009087", firstName: "Thabo", lastName: "Mokoena" } },
      { index: 1, mapped: { saIdNumber: "8001015009087", firstName: "Thabo", lastName: "Mokoena" } },
    ];
    const dupes = findDuplicateSourceRecords(records);
    expect(dupes.get(0)).toContain(1);
  });

  it("matches an existing LMS learner instead of creating a silent duplicate", () => {
    const match = matchExistingLearner(
      { saIdNumber: "8001015009087", firstName: "Thabo", lastName: "Mokoena", studentNumber: "ADM001" },
      [
        {
          id: "existing-1",
          firstName: "Thabo",
          lastName: "Mokoena",
          studentNumber: "OTHER",
          saIdNumber: "8001015009087",
          dateOfBirth: null,
        },
      ]
    );
    expect(match.existingId).toBe("existing-1");
    expect(match.suggested).toBe("UPDATE_EXISTING");
  });

  it("does not import rows marked for manual review or skip", () => {
    expect(shouldSkipStagingRecord({ validationStatus: "OK", duplicateAction: "REVIEW_MANUALLY" })).toBe(true);
    expect(shouldSkipStagingRecord({ validationStatus: "ERROR", duplicateAction: "CREATE_NEW" })).toBe(true);
    expect(shouldSkipStagingRecord({ validationStatus: "OK", duplicateAction: "CREATE_NEW" })).toBe(false);
  });

  it("auto-maps common SA-SAMS-style headers to LMS fields", () => {
    const mappings = autoMapHeaders(
      ["Learner Name", "Learner Surname", "Identity Number", "Admission Number", "Grade", "Class", "Guardian"],
      "learner"
    );
    const bySource = Object.fromEntries(mappings.map((m) => [m.sourceField, m.targetField]));
    expect(bySource["Learner Name"]).toBe("firstName");
    expect(bySource["Identity Number"]).toBe("saIdNumber");
    expect(bySource["Admission Number"]).toBe("studentNumber");
  });

  it("rejects unsupported formats", () => {
    const detected = detectImporter("school.exe", "application/octet-stream", Buffer.from("MZ"));
    expect(detected.importer).toBeNull();
    expect(validateUpload("payload.exe", "application/octet-stream", 100)).toBeTruthy();
  });
});
