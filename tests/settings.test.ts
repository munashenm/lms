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

  it("accepts portal colour themes as hex values", () => {
    const parsed = schoolSettingsSchema.safeParse({
      primaryColor: "#14532D",
      accentColor: "#FBBF24",
    });
    expect(parsed.success).toBe(true);
  });

  it("allows clearing colours and rejects invalid hex", () => {
    expect(schoolSettingsSchema.safeParse({ primaryColor: "" }).success).toBe(true);
    expect(schoolSettingsSchema.safeParse({ primaryColor: "#1B4D6E" }).success).toBe(true);
    expect(schoolSettingsSchema.safeParse({ primaryColor: "navy" }).success).toBe(false);
    expect(schoolSettingsSchema.safeParse({ accentColor: "#FFF" }).success).toBe(false);
  });

  it("accepts public website copy fields", () => {
    const parsed = schoolSettingsSchema.safeParse({
      heroHeadline: "Learn with us",
      heroSubtitle: "A Cape Town school",
      aboutText: "About the school",
      missionText: "Our mission",
      admissionsText: "How to apply",
    });
    expect(parsed.success).toBe(true);
  });
});
