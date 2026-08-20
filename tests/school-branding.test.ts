import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  PORTAL_THEMES,
  hexToPdfRgb,
  isHexColor,
  lightenHex,
  matchPortalThemeId,
  normalizeHexColor,
  schoolThemeCssVars,
  toSchoolPortalBrand,
} from "@/lib/school-branding";

describe("school branding", () => {
  it("normalises hex colours and rejects invalid values", () => {
    expect(isHexColor("#1B4D6E")).toBe(true);
    expect(isHexColor("#e8a317")).toBe(true);
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("1B4D6E")).toBe(false);
    expect(normalizeHexColor("#e8a317", DEFAULT_ACCENT_COLOR)).toBe("#E8A317");
    expect(normalizeHexColor("navy", DEFAULT_PRIMARY_COLOR)).toBe(DEFAULT_PRIMARY_COLOR);
  });

  it("matches preset themes and treats unknown pairs as custom", () => {
    expect(matchPortalThemeId(null, null)).toBe("navy");
    expect(matchPortalThemeId(PORTAL_THEMES[2].primary, PORTAL_THEMES[2].accent)).toBe("maroon");
    expect(matchPortalThemeId("#112233", "#445566")).toBe("custom");
  });

  it("exposes CSS variables for the portal theme", () => {
    const vars = schoolThemeCssVars("#14532D", "#FBBF24") as Record<string, string>;
    expect(vars["--primary"]).toBe("#14532D");
    expect(vars["--accent"]).toBe("#FBBF24");
    expect(vars["--color-primary"]).toBe("#14532D");
    expect(vars["--primary-light"]).toBe(lightenHex("#14532D"));
  });

  it("converts hex to pdf-lib RGB fractions", () => {
    expect(hexToPdfRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToPdfRgb("#FFFFFF")).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("maps a school record onto portal brand fields", () => {
    expect(toSchoolPortalBrand(null)).toEqual({
      schoolName: null,
      logoUrl: null,
      primaryColor: null,
      accentColor: null,
    });
    expect(
      toSchoolPortalBrand({
        name: "Cyber College",
        logoUrl: "/uploads/x/logo.png",
        primaryColor: "#115E59",
        accentColor: "#F4C430",
      })
    ).toEqual({
      schoolName: "Cyber College",
      logoUrl: "/uploads/x/logo.png",
      primaryColor: "#115E59",
      accentColor: "#F4C430",
    });
  });

  it("builds an accessible logo alt label", async () => {
    const { schoolLogoAlt } = await import("@/lib/school-branding");
    expect(schoolLogoAlt("Cyber College")).toBe("Cyber College logo");
    expect(schoolLogoAlt("  ")).toBe("School logo");
    expect(schoolLogoAlt(null)).toBe("School logo");
  });
});
