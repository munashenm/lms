import { describe, expect, it } from "vitest";
import { schoolSettingsSchema } from "@/lib/validators";
import { normalizeWebsiteUrl, validateSAPhone } from "@/lib/sa-validation";

describe("school settings", () => {
  it("accepts a typical school profile save", () => {
    const parsed = schoolSettingsSchema.safeParse({
      name: "Cyber College",
      email: "info@college.co.za",
      phone: "087 550 1813",
      website: "https://www.cyberdevelopers.co.za",
      institutionType: "COLLEGE",
      curriculumType: "CAPS",
      periodStructure: "SEMESTERS_2",
      absenceNotifyEnabled: false,
      teacherReviewsAnonymous: true,
      studentLeaveRequiresGuardian: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts websites without a protocol and blank website placeholders", () => {
    expect(normalizeWebsiteUrl("www.school.co.za")).toBe("https://www.school.co.za");
    expect(normalizeWebsiteUrl("https://")).toBe("");
    expect(schoolSettingsSchema.safeParse({ website: "www.school.co.za" }).success).toBe(true);
    expect(schoolSettingsSchema.safeParse({ website: "" }).success).toBe(true);
    expect(schoolSettingsSchema.safeParse({ website: "https://" }).success).toBe(true);
  });

  it("accepts +27 phone numbers", () => {
    expect(validateSAPhone("+27821234567")).toBe(true);
    expect(schoolSettingsSchema.safeParse({ phone: "+27821234567" }).success).toBe(true);
    expect(schoolSettingsSchema.safeParse({ phone: "0821234567" }).success).toBe(true);
  });
});
