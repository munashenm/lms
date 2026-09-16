import { existsSync } from "fs";
import path from "path";
import { DEFAULT_BRAND_LOGO_URL, DEFAULT_BRAND_MARK_URL } from "@/lib/constants";
import { resolveBrandLogo, resolveBrandMark, type SchoolPortalBrand } from "@/lib/school-branding";

function isRemoteAsset(url: string): boolean {
  return /^(https?:|data:|\/\/)/i.test(url);
}

export function publicAssetPath(url: string): string | null {
  if (!url.startsWith("/") || isRemoteAsset(url)) return null;
  let relative: string;
  try {
    relative = decodeURIComponent(url.split("?")[0] ?? "").replace(/^\/+/, "");
  } catch {
    return null;
  }
  if (!relative || relative.includes("\0") || relative.split("/").includes("..")) return null;
  const publicRoot = path.resolve(process.cwd(), "public");
  const full = path.resolve(publicRoot, relative);
  const prefix = publicRoot.endsWith(path.sep) ? publicRoot : `${publicRoot}${path.sep}`;
  if (full !== publicRoot && !full.startsWith(prefix)) return null;
  return full;
}

export function publicAssetExists(url: string): boolean {
  if (isRemoteAsset(url)) return true;
  const full = publicAssetPath(url);
  return Boolean(full && existsSync(full));
}

export function resolveAvailableBrandLogo(logoUrl?: string | null): string {
  const resolved = resolveBrandLogo(logoUrl);
  if (publicAssetExists(resolved)) return resolved;
  return DEFAULT_BRAND_LOGO_URL;
}

export function resolveAvailableBrandMark(logoUrl?: string | null): string {
  const resolved = resolveBrandMark(logoUrl);
  if (publicAssetExists(resolved)) return resolved;
  return DEFAULT_BRAND_MARK_URL;
}

export function availablePortalBrand(brand: SchoolPortalBrand): SchoolPortalBrand {
  return { ...brand, logoUrl: resolveAvailableBrandLogo(brand.logoUrl) };
}
