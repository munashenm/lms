import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool } from "@/lib/rbac";
import { denyUnless } from "@/lib/access";
import { schoolModulesSchema } from "@/lib/validators";
import { isSystemModuleKey, SYSTEM_MODULE_LABELS, SYSTEM_MODULES } from "@/lib/modules";
import { logAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/request-meta";
import { resolveLicenseSchoolId } from "@/lib/licensing/enforce";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const denied = await denyUnless(session, "settings.manage");
  if (denied) return denied;

  const schoolId = await resolveLicenseSchoolId(session!, request.nextUrl.searchParams.get("schoolId"));
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Select a school before managing modules." }, { status: 400 });
  }

  const rows = await prisma.schoolModule.findMany({ where: { schoolId } });
  const enabled = new Map(rows.map((row) => [row.moduleKey, row.enabled]));
  return NextResponse.json({
    schoolId,
    modules: SYSTEM_MODULES.map((moduleKey) => ({
      moduleKey,
      label: SYSTEM_MODULE_LABELS[moduleKey],
      enabled: enabled.has(moduleKey) ? enabled.get(moduleKey) !== false : true,
    })),
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

  for (const item of parsed.data.modules) {
    if (!isSystemModuleKey(item.moduleKey)) continue;
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
