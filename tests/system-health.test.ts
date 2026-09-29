import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { needsSuperAdminSchoolPicker } from "@/lib/licensing/enforce";

describe("system health school selection", () => {
  it("requires Super Admin without a home school to pick an institution", () => {
    expect(
      needsSuperAdminSchoolPicker(
        { role: UserRole.SUPER_ADMIN, schoolId: null },
        undefined
      )
    ).toBe(true);
    expect(
      needsSuperAdminSchoolPicker(
        { role: UserRole.SUPER_ADMIN, schoolId: null },
        "school-1"
      )
    ).toBe(false);
  });

  it("does not force a picker for school-scoped admins", () => {
    expect(
      needsSuperAdminSchoolPicker(
        { role: UserRole.SCHOOL_ADMIN, schoolId: "school-1" },
        undefined
      )
    ).toBe(false);
  });
});
