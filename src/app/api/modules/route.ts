import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool } from "@/lib/rbac";
import { denyUnless } from "@/lib/access";
import { schoolModulesSchema } from "@/lib/validators";
import {
  isSystemModuleKey,
  licenseFeatureForModule,
  SYSTEM_MODULE_LABELS,
  SYSTEM_MODULES,
} from "@/lib/modules";
import { logAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/request-meta";
import {
  claimsAllowFeature,
  requireLicenseMutation,
  resolveLicenseSchoolId,
} from "@/lib/licensing/enforce";
import { evaluateStoredLicense } from "@/lib/licensing/service";
import { FEATURE_DISABLED_MESSAGE } from "@/lib/licensing/types";
import { LICENSE_FEATURE_LABELS } from "@/lib/licensing/features";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const denied = await denyUnless(session, "settings.manage");
  if (denied) return denied;

  const schoolId = await resolveLicenseSchoolId(session!, request.nextUrl.searchParams.get("schoolId"));
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Select a school before managing modules." }, { status: 400 });
  }

  const [rows, evaluation] = await Promise.all([
    prisma.schoolModule.findMany({ where: { schoolId } }),
    evaluateStoredLicense(schoolId),
  ]);
  const enabled = new Map(rows.map((row) => [row.moduleKey, row.enabled]));
  const features = evaluation.claims?.features ?? null;

  return NextResponse.json({
    schoolId,
    modules: SYSTEM_MODULES.map((moduleKey) => {
      const feature = licenseFeatureForModule(moduleKey);
      const licenceAllows = feature ? claimsAllowFeature(features, feature) : true;
      return {
        moduleKey,
        label: SYSTEM_MODULE_LABELS[moduleKey],
        enabled: enabled.has(moduleKey) ? enabled.get(moduleKey) !== false : true,
        licenseFeature: feature,
        licenceAllows,
      };
    }),
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  const denied = await denyUnless(session, "settings.manage");
  if (denied) return denied;

  const parsed = schoolModulesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }
  const schoolId = await resolveLicenseSchoolId(session!, parsed.data.schoolId);
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Select a school before managing modules." }, { status: 400 });
  }

  const restricted = await requireLicenseMutation(schoolId, {
    pathname: "/api/modules",
    method: "PUT",
  });
  if (restricted) return restricted;

  const evaluation = await evaluateStoredLicense(schoolId);
  const features = evaluation.claims?.features ?? null;
  const isSuperAdmin = session!.role === UserRole.SUPER_ADMIN;

  for (const item of parsed.data.modules) {
    if (!isSystemModuleKey(item.moduleKey)) continue;
    if (item.enabled && !isSuperAdmin) {
      const feature = licenseFeatureForModule(item.moduleKey);
      if (feature && !claimsAllowFeature(features, feature)) {
        const label = LICENSE_FEATURE_LABELS[feature] ?? feature;
        return NextResponse.json(
          {
            code: "LICENSE_FEATURE_DISABLED",
            message: `${FEATURE_DISABLED_MESSAGE} (${label})`,
            feature,
            moduleKey: item.moduleKey,
          },
          { status: 403 }
        );
      }
    }
    await prisma.schoolModule.upsert({
      where: { schoolId_moduleKey: { schoolId, moduleKey: item.moduleKey } },
      update: { enabled: item.enabled },
      create: { schoolId, moduleKey: item.moduleKey, enabled: item.enabled },
    });
  }

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "MODULES_UPDATE",
    entity: "School",
    entityId: schoolId,
    metadata: { modules: parsed.data.modules },
    ...requestMeta(request),
  });

  return NextResponse.json({ ok: true });
}
