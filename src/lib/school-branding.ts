import type { CSSProperties } from "react";

export const DEFAULT_PRIMARY_COLOR = "#1B4D6E";
export const DEFAULT_ACCENT_COLOR = "#E8A317";

export const PORTAL_THEMES = [
  { id: "navy", name: "Navy & gold", primary: "#1B4D6E", accent: "#E8A317" },
  { id: "forest", name: "Forest", primary: "#14532D", accent: "#FBBF24" },
  { id: "maroon", name: "Maroon", primary: "#7F1D1D", accent: "#F59E0B" },
  { id: "royal", name: "Royal blue", primary: "#1E3A8A", accent: "#38BDF8" },
  { id: "teal", name: "Teal", primary: "#115E59", accent: "#F4C430" },
  { id: "charcoal", name: "Charcoal", primary: "#1F2937", accent: "#E8A317" },
] as const;

export type PortalThemeId = (typeof PORTAL_THEMES)[number]["id"] | "custom";

const HEX = /^#([0-9A-Fa-f]{6})$/;

export function isHexColor(value: string | null | undefined): value is string {
  return Boolean(value && HEX.test(value));
}

export function normalizeHexColor(value: string | null | undefined, fallback: string): string {
  if (!isHexColor(value)) return fallback;
  return `#${value.slice(1).toUpperCase()}`;
}

function hexToRgbTuple(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex, DEFAULT_PRIMARY_COLOR);
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

export function lightenHex(hex: string, amount = 0.18): string {
  const { r, g, b } = hexToRgbTuple(hex);
  const lift = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `#${[lift(r), lift(g), lift(b)].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function hexToPdfRgb(hex: string): { r: number; g: number; b: number } {
  const { r, g, b } = hexToRgbTuple(hex);
  return { r: r / 255, g: g / 255, b: b / 255 };
}

export type SchoolPortalBrand = {
  schoolName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
};

export function emptySchoolPortalBrand(): SchoolPortalBrand {
  return { schoolName: null, logoUrl: null, primaryColor: null, accentColor: null };
}

export function schoolLogoAlt(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? `${trimmed} logo` : "School logo";
}

export function toSchoolPortalBrand(
  school:
    | {
        name?: string | null;
        logoUrl?: string | null;
        primaryColor?: string | null;
        accentColor?: string | null;
      }
    | null
    | undefined
): SchoolPortalBrand {
  if (!school) return emptySchoolPortalBrand();
  return {
    schoolName: school.name ?? null,
    logoUrl: school.logoUrl ?? null,
    primaryColor: school.primaryColor ?? null,
    accentColor: school.accentColor ?? null,
  };
}

export function matchPortalThemeId(
  primary: string | null | undefined,
  accent: string | null | undefined
): PortalThemeId {
  if (!primary && !accent) return "navy";
  const p = normalizeHexColor(primary, DEFAULT_PRIMARY_COLOR);
  const a = normalizeHexColor(accent, DEFAULT_ACCENT_COLOR);
  const match = PORTAL_THEMES.find((theme) => theme.primary === p && theme.accent === a);
  return match?.id ?? "custom";
}

export function schoolThemeCssVars(
  primary?: string | null,
  accent?: string | null
): CSSProperties {
  const primaryHex = normalizeHexColor(primary, DEFAULT_PRIMARY_COLOR);
  const accentHex = normalizeHexColor(accent, DEFAULT_ACCENT_COLOR);
  const primaryLight = lightenHex(primaryHex);
  return {
    "--primary": primaryHex,
    "--primary-light": primaryLight,
    "--accent": accentHex,
    "--color-primary": primaryHex,
    "--color-primary-light": primaryLight,
    "--color-accent": accentHex,
  } as CSSProperties;
}
