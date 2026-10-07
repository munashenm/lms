import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    school: {
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
  },
}));

import {
  credentialSignInPath,
  evaluateBrandedLoginTenant,
  getSchoolBySlug,
  institutionApplyPath,
  institutionHomePath,
  institutionLoginPath,
  isInstitutionPublicPath,
  isReservedInstitutionSlug,
  normalizeInstitutionSlug,
} from "@/lib/institution-portal";

describe("getSchoolBySlug", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("resolves active school branding fields by slug", async () => {
    findFirst.mockResolvedValue({
      id: "s1",
      name: "Champions Academy",
      slug: "champions-academy",
      isActive: true,
      logoUrl: "/uploads/logo.png",
      primaryColor: "#1B4D6E",
      accentColor: "#E8A317",
    });
    const school = await getSchoolBySlug("champions-academy");
    expect(school?.name).toBe("Champions Academy");
    expect(school?.logoUrl).toBe("/uploads/logo.png");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "champions-academy", isActive: true },
      })
    );
  });

  it("returns null for unknown slug", async () => {
    findFirst.mockResolvedValue(null);
    expect(await getSchoolBySlug("missing-school")).toBeNull();
  });

  it("does not query reserved or inactive-looking reserved slugs", async () => {
    expect(await getSchoolBySlug("admin")).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("institution slug helpers", () => {
  it("normalizes valid slugs and rejects reserved ones", () => {
    expect(normalizeInstitutionSlug("Champions-Academy")).toBe("champions-academy");
    expect(normalizeInstitutionSlug("admin")).toBeNull();
    expect(normalizeInstitutionSlug("login")).toBeNull();
    expect(normalizeInstitutionSlug("../evil")).toBeNull();
    expect(isReservedInstitutionSlug("apply")).toBe(true);
    expect(isReservedInstitutionSlug("champions-academy")).toBe(false);
  });

  it("recognises public institution paths", () => {
    expect(isInstitutionPublicPath("/champions-academy")).toBe(true);
    expect(isInstitutionPublicPath("/champions-academy/login")).toBe(true);
    expect(isInstitutionPublicPath("/champions-academy/parent/login")).toBe(true);
    expect(isInstitutionPublicPath("/champions-academy/student/login")).toBe(true);
    expect(isInstitutionPublicPath("/champions-academy/apply")).toBe(true);
    expect(isInstitutionPublicPath("/admin/dashboard")).toBe(false);
    expect(isInstitutionPublicPath("/login")).toBe(false);
    expect(isInstitutionPublicPath("/champions-academy/secret")).toBe(false);
  });

  it("builds branded portal paths", () => {
    expect(institutionHomePath("champions-academy")).toBe("/champions-academy");
    expect(institutionLoginPath("champions-academy", "staff")).toBe("/champions-academy/login");
    expect(institutionLoginPath("champions-academy", "parent")).toBe(
      "/champions-academy/parent/login"
    );
    expect(institutionLoginPath("champions-academy", "student")).toBe(
      "/champions-academy/student/login"
    );
    expect(institutionApplyPath("champions-academy")).toBe("/champions-academy/apply");
  });
});

describe("credential invite URLs", () => {
  it("sends staff to the institution entry page when slug is available", () => {
    expect(
      credentialSignInPath({ role: "staff", schoolSlug: "champions-academy" })
    ).toBe("/champions-academy");
  });

  it("falls back to global /login for staff without slug", () => {
    expect(credentialSignInPath({ role: "staff", schoolSlug: null })).toBe("/login");
    expect(credentialSignInPath({ role: "staff" })).toBe("/login");
  });

  it("keeps parent and learner branded paths when slug exists", () => {
    expect(
      credentialSignInPath({ role: "parent", schoolSlug: "champions-academy" })
    ).toBe("/champions-academy/parent/login");
    expect(
      credentialSignInPath({ role: "student", schoolSlug: "champions-academy" })
    ).toBe("/champions-academy/student/login");
  });

  it("keeps global parent/student login fallbacks", () => {
    expect(credentialSignInPath({ role: "parent" })).toBe("/parent/login");
    expect(credentialSignInPath({ role: "student" })).toBe("/student/login");
  });

  it("never emits the broken /staff/login path", () => {
    expect(credentialSignInPath({ role: "staff", schoolSlug: "x" })).not.toContain("/staff/login");
    expect(credentialSignInPath({ role: "staff" })).not.toBe("/staff/login");
  });
});

describe("branded login tenant check", () => {
  it("allows matching school membership", () => {
    expect(
      evaluateBrandedLoginTenant({
        userSchoolId: "school-a",
        portalSchoolId: "school-a",
      })
    ).toEqual({ ok: true });
  });

  it("blocks School A credentials on School B portal", () => {
    expect(
      evaluateBrandedLoginTenant({
        userSchoolId: "school-a",
        portalSchoolId: "school-b",
      })
    ).toEqual({ ok: false, code: "PORTAL_SCHOOL_MISMATCH" });
  });

  it("blocks parent/learner mismatches the same way", () => {
    const result = evaluateBrandedLoginTenant({
      userSchoolId: "champions",
      portalSchoolId: "emmanuel",
      userRole: "PARENT",
    });
    expect(result.ok).toBe(false);
  });

  it("does not change tenant from URL alone when user has no school", () => {
    expect(
      evaluateBrandedLoginTenant({
        userSchoolId: null,
        portalSchoolId: "school-b",
        userRole: "SCHOOL_ADMIN",
      }).ok
    ).toBe(false);
  });

  it("allows unbound Super Admin on branded staff portals", () => {
    expect(
      evaluateBrandedLoginTenant({
        userSchoolId: null,
        portalSchoolId: "school-a",
        userRole: "SUPER_ADMIN",
      })
    ).toEqual({ ok: true });
  });
});
