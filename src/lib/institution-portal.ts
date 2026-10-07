import { prisma } from "@/lib/db";
import { isApplicationsOpen } from "@/lib/admissions";
import type { LoginPortal } from "@/lib/login-portals";

/** Top-level segments that must never be treated as institution slugs. */
export const RESERVED_INSTITUTION_SLUGS = new Set([
  "login",
  "logout",
  "forgot-password",
  "reset-password",
  "account",
  "admin",
  "teacher",
  "student",
  "parent",
  "finance",
  "hr",
  "staff",
  "apply",
  "about",
  "admissions",
  "academics",
  "programmes",
  "fees",
  "contact",
  "news",
  "calendar",
  "gallery",
  "privacy",
  "brand",
  "api",
  "uploads",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
  "apple-touch-icon",
  "_next",
  "pricing",
  "institutions",
  "licensing",
]);

export function normalizeInstitutionSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  const slug = value.trim().toLowerCase();
  if (!slug || RESERVED_INSTITUTION_SLUGS.has(slug)) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return slug;
}

export function isReservedInstitutionSlug(value: string): boolean {
  return RESERVED_INSTITUTION_SLUGS.has(value.trim().toLowerCase());
}

/** Public paths under /{schoolSlug}/… that must not require authentication. */
export function isInstitutionPublicPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return false;
  const slug = normalizeInstitutionSlug(parts[0]);
  if (!slug) return false;
  if (parts.length === 1) return true;
  if (parts.length === 2 && (parts[1] === "login" || parts[1] === "apply")) return true;
  if (
    parts.length === 3 &&
    parts[2] === "login" &&
    (parts[1] === "parent" || parts[1] === "student")
  ) {
    return true;
  }
  return false;
}

export function institutionHomePath(slug: string): string {
  return `/${slug}`;
}

export function institutionLoginPath(slug: string, portal: LoginPortal = "staff"): string {
  if (portal === "parent") return `/${slug}/parent/login`;
  if (portal === "student") return `/${slug}/student/login`;
  return `/${slug}/login`;
}

export function institutionApplyPath(slug: string): string {
  return `/${slug}/apply`;
}

export function credentialSignInPath(opts: {
  role: "staff" | "parent" | "student";
  schoolSlug?: string | null;
}): string {
  const slug = normalizeInstitutionSlug(opts.schoolSlug ?? null);
  if (slug) {
    if (opts.role === "staff") return institutionHomePath(slug);
    return institutionLoginPath(slug, opts.role);
  }
  if (opts.role === "parent") return "/parent/login";
  if (opts.role === "student") return "/student/login";
  return "/login";
}

export type PublicInstitution = NonNullable<Awaited<ReturnType<typeof getSchoolBySlug>>>;

/**
 * Resolve an active institution for public branding / apply targeting.
 * Does not expose private operational data. Never grants authorization.
 */
export async function getSchoolBySlug(rawSlug: string | null | undefined) {
  const slug = normalizeInstitutionSlug(rawSlug);
  if (!slug) return null;
  try {
    return await prisma.school.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        institutionType: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        accentColor: true,
        heroHeadline: true,
        heroSubtitle: true,
        heroImageUrl: true,
        aboutText: true,
        email: true,
        phone: true,
        website: true,
        applicationsOpen: true,
        applicationsOpenFrom: true,
        applicationsOpenUntil: true,
        applicationInstructions: true,
        admissionsText: true,
        requiredApplicationDocuments: true,
        popiaConsentText: true,
        admissionYear: { select: { id: true, name: true, startDate: true, endDate: true } },
        campuses: {
          where: { isActive: true },
          orderBy: [{ isMain: "desc" }, { name: "asc" }],
          select: { id: true, name: true, isMain: true },
        },
        grades: {
          where: { isActive: true, openForApplications: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, openForApplications: true },
        },
        courses: {
          where: { isActive: true, openForApplications: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, openForApplications: true },
        },
      },
    });
  } catch {
    return null;
  }
}

export function institutionApplicationsOpen(school: {
  applicationsOpen: boolean;
  applicationsOpenFrom: Date | null;
  applicationsOpenUntil: Date | null;
}) {
  return isApplicationsOpen(school);
}

/**
 * Pure tenant check for branded login. Authorization remains User.schoolId.
 * Super Admin (null schoolId) may use branded staff login for platform support.
 */
export function evaluateBrandedLoginTenant(opts: {
  userSchoolId: string | null;
  portalSchoolId: string;
  userRole?: string | null;
}): { ok: true } | { ok: false; code: "PORTAL_SCHOOL_MISMATCH" } {
  if (opts.userRole === "SUPER_ADMIN" && !opts.userSchoolId) {
    return { ok: true };
  }
  if (!opts.userSchoolId || opts.userSchoolId !== opts.portalSchoolId) {
    return { ok: false, code: "PORTAL_SCHOOL_MISMATCH" };
  }
  return { ok: true };
}
