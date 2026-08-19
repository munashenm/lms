import { NextResponse } from "next/server";
import type { SessionPayload } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { FEATURE_DISABLED_MESSAGE, LEARNER_LIMIT_MESSAGE, RESTRICTED_MODE_MESSAGE } from "./types";
import type { LicenseAction, LicenseFeatureKey } from "./types";
import { maybeHeartbeat, trustUnsignedLocal } from "./service";
import { learnerLimitReached, staffLimitReached } from "./evaluate";
import { countLicenseUsage } from "./usage";
import { isKnownFeature } from "./features";

export const LICENSE_ALLOWED_WHEN_RESTRICTED = [
  "/admin/settings/licence",
  "/admin/settings/backup",
  "/admin/system-health",
  "/account/password",
  "/api/license",
  "/api/backups",
  "/api/auth",
  "/api/notifications",
  "/api/school",
  "/login",
  "/contact",
];

export function isRestrictedPathAllowed(pathname: string, method: string): boolean {
  if (method === "GET" && pathname.startsWith("/api/license")) return true;
  if (pathname.startsWith("/api/backups") && ["GET", "POST"].includes(method)) return true;
  if (pathname.startsWith("/admin/settings/licence")) return true;
  if (pathname.startsWith("/admin/settings/backup")) return true;
  if (pathname.startsWith("/account/password")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/login" || pathname === "/contact") return true;
  if (pathname.startsWith("/api/notifications")) return true;
  return LICENSE_ALLOWED_WHEN_RESTRICTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function getEffectiveLicense(schoolId: string) {
  return maybeHeartbeat(schoolId);
}

export async function licenseWriteGuard(opts: {
  schoolId: string;
  action?: LicenseAction;
  feature?: LicenseFeatureKey;
  activatingLearner?: boolean;
}): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
  const evaluation = await getEffectiveLicense(opts.schoolId);

  if (evaluation.restricted) {
    return {
      ok: false,
      status: 403,
      body: {
        code: "LICENSE_RESTRICTED",
        message: RESTRICTED_MODE_MESSAGE,
        status: evaluation.effectiveStatus,
      },
    };
  }

  if (opts.feature && evaluation.claims) {
    const enabled = evaluation.claims.features[opts.feature];
    if (enabled === false) {
      return {
        ok: false,
        status: 403,
        body: { code: "LICENSE_FEATURE_DISABLED", message: FEATURE_DISABLED_MESSAGE, feature: opts.feature },
      };
    }
  }

  if (opts.action === "create_learner" || opts.action === "activate_learner" || opts.activatingLearner) {
    const usage = await countLicenseUsage(opts.schoolId);
    const max = evaluation.claims?.limits.maxLearners ?? null;
    if (learnerLimitReached(usage.activeLearners, max)) {
      return {
        ok: false,
        status: 403,
        body: { code: "LICENSE_LEARNER_LIMIT", message: LEARNER_LIMIT_MESSAGE },
      };
    }
  }

  if (opts.action === "create_educator") {
    const usage = await countLicenseUsage(opts.schoolId);
    if (staffLimitReached(usage.educators, evaluation.claims?.limits.maxEducators ?? null)) {
      return {
        ok: false,
        status: 403,
        body: {
          code: "LICENSE_STAFF_LIMIT",
          message: "Your institution has reached the educator limit for the current licence. Please contact your LMS provider to upgrade.",
        },
      };
    }
  }

  if (opts.action === "create_administrator") {
    const usage = await countLicenseUsage(opts.schoolId);
    if (staffLimitReached(usage.administrators, evaluation.claims?.limits.maxAdministrators ?? null)) {
      return {
        ok: false,
        status: 403,
        body: {
          code: "LICENSE_ADMIN_LIMIT",
          message: "Your institution has reached the administrator/staff limit for the current licence. Please contact your LMS provider to upgrade.",
        },
      };
    }
  }

  if (opts.action === "create_campus") {
    const usage = await countLicenseUsage(opts.schoolId);
    if (staffLimitReached(usage.campuses, evaluation.claims?.limits.maxCampuses ?? null)) {
      return {
        ok: false,
        status: 403,
        body: {
          code: "LICENSE_CAMPUS_LIMIT",
          message: "Your institution has reached the campus limit for the current licence. Please contact your LMS provider to upgrade.",
        },
      };
    }
  }

  return { ok: true };
}

export function licenseDeniedResponse(
  result: Extract<Awaited<ReturnType<typeof licenseWriteGuard>>, { ok: false }>
) {
  return NextResponse.json(result.body, { status: result.status });
}

export async function assertFeatureEnabled(schoolId: string, feature: LicenseFeatureKey) {
  return licenseWriteGuard({ schoolId, feature });
}

export async function resolveLicenseSchoolId(
  session: SessionPayload,
  requestedSchoolId?: string | null
): Promise<string | null> {
  if (session.role === UserRole.SUPER_ADMIN && requestedSchoolId) {
    const exists = await prisma.school.findUnique({
      where: { id: requestedSchoolId },
      select: { id: true },
    });
    return exists?.id ?? null;
  }
  return session.schoolId;
}

export { isKnownFeature, trustUnsignedLocal };
