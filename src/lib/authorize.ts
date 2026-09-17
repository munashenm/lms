import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import type { SessionPayload } from "./auth";
import { forbiddenJson, FORBIDDEN_MESSAGE } from "./http";
import { permissionModule, type SystemModuleKey } from "./modules";
import { requirePermission, canAccessSchool, type Permission } from "./rbac";
import { schoolModuleEnabled } from "./access";

export type AuthorizeOk = { ok: true; session: SessionPayload };
export type AuthorizeFail = { ok: false; status: 401 | 403 | 404; response: NextResponse };

export async function authorize(opts: {
  session: SessionPayload | null;
  permission?: Permission;
  module?: SystemModuleKey;
  resourceInstitutionId?: string | null;
}): Promise<AuthorizeOk | AuthorizeFail> {
  const { session } = opts;
  if (!session) {
    return {
      ok: false,
      status: 401,
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  if (opts.permission && !requirePermission(session, opts.permission)) {
    return { ok: false, status: 403, response: forbiddenJson() };
  }

  if (opts.resourceInstitutionId && !canAccessSchool(session, opts.resourceInstitutionId)) {
    return {
      ok: false,
      status: 404,
      response: NextResponse.json({ message: "Not found" }, { status: 404 }),
    };
  }

  const moduleKey = opts.module ?? (opts.permission ? permissionModule(opts.permission) : undefined);
  if (moduleKey && session.role !== UserRole.SUPER_ADMIN) {
    const schoolId = opts.resourceInstitutionId ?? session.schoolId;
    if (!(await schoolModuleEnabled(schoolId, moduleKey))) {
      return {
        ok: false,
        status: 403,
        response: NextResponse.json({ message: FORBIDDEN_MESSAGE }, { status: 403 }),
      };
    }
  }

  return { ok: true, session };
}

export function tenantMiss() {
  return NextResponse.json({ message: "Not found" }, { status: 404 });
}
