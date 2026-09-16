import { getSession } from "@/lib/auth";
import { requirePermission, rolePermissionSet } from "@/lib/rbac";
import { AccessDenied } from "@/components/layout/access-denied";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/constants";
import { UserRole } from "@prisma/client";
import { defaultActionPermissionsForRole, PERMISSION_LABELS } from "@/lib/permissions";
import Link from "next/link";

export default async function RolesPage() {
  const session = await getSession();
  if (!requirePermission(session, "users.permissions")) return <AccessDenied />;

  const roles = Object.values(UserRole).filter((role) => role !== UserRole.STUDENT && role !== UserRole.PARENT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roles & Permissions</h1>
        <p className="text-muted text-sm mt-1">
          Role defaults are listed below. Customise an individual account from Users → Permissions.
        </p>
      </div>
      {roles.map((role) => {
        const defaults = defaultActionPermissionsForRole(role, rolePermissionSet(role));
        return (
          <Card key={role}>
            <CardHeader>
              <CardTitle className="text-base">{ROLE_LABELS[role]}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted">
              {role === UserRole.SUPER_ADMIN
                ? "Full platform access, including disabled institution modules."
                : defaults.map((permission) => PERMISSION_LABELS[permission]).join(" · ") || "No action permissions."}
            </CardContent>
          </Card>
        );
      })}
      <Link className="text-primary font-medium" href="/admin/users">Open users</Link>
    </div>
  );
}
