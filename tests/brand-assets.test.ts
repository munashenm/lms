import { describe, expect, it } from "vitest";
import {
  availablePortalBrand,
  publicAssetExists,
  publicAssetPath,
  resolveAvailableBrandLogo,
  resolveAvailableBrandMark,
} from "@/lib/brand-assets";

describe("public brand assets", () => {
  it("maps site-root paths onto files in public/", () => {
    const logoPath = publicAssetPath("/brand/logo.png");
    expect(logoPath).toMatch(/public[\\/]brand[\\/]logo\.png$/);
    expect(publicAssetPath("https://cdn.example/logo.png")).toBeNull();
    expect(publicAssetPath("/uploads/../.env")).toBeNull();
  });

  it("finds the bundled SchoolHub SA artwork", () => {
    expect(publicAssetExists("/brand/logo.png")).toBe(true);
    expect(publicAssetExists("/brand/mark.png")).toBe(true);
    expect(publicAssetExists("/uploads/missing/branding/logo.png")).toBe(false);
  });

  it("falls back when a stored upload is missing from disk", () => {
    expect(resolveAvailableBrandLogo(null)).toBe("/brand/logo.png");
    expect(resolveAvailableBrandLogo("/uploads/cmq9q3tnm0000v23kqbv6am04/branding/logo-gone.png")).toBe(
      "/brand/logo.png"
    );
    expect(resolveAvailableBrandLogo("/brand/logo.png")).toBe("/brand/logo.png");
    expect(resolveAvailableBrandLogo("https://cdn.example/school.png")).toBe("https://cdn.example/school.png");
    expect(resolveAvailableBrandMark("/uploads/missing/mark.png")).toBe("/brand/mark.png");
  });

  it("replaces a missing portal logo with the bundled artwork", () => {
    expect(
      availablePortalBrand({
        schoolName: "Smart School/College",
        logoUrl: "/uploads/missing/logo.png",
        primaryColor: "#14532D",
        accentColor: "#FBBF24",
      }).logoUrl
    ).toBe("/brand/logo.png");
  });
});
