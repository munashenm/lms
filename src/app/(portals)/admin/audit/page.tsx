import Link from "next/link";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ page?: string; entity?: string; schoolId?: string }>;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !requirePermission(session, "audit:read")) {
    redirect("/admin/dashboard");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const take = 50;
  const skip = (page - 1) * take;

  const filter = getSchoolFilter(session);
  const schoolId =
    session.role === UserRole.SUPER_ADMIN && params.schoolId
      ? params.schoolId
      : "schoolId" in filter
        ? filter.schoolId
        : undefined;

  const where = {
    ...(schoolId ? { schoolId } : {}),
    ...(params.entity ? { entity: params.entity } : {}),
  };

  const [logs, total, schools] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.auditLog.count({ where }),
    session.role === UserRole.SUPER_ADMIN
      ? prisma.school.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const pages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted text-sm mt-1">
          POPIA compliance trail of sensitive actions across the school
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        {schools.length > 0 && (
          <form method="GET" className="flex gap-2 items-end">
            <div>
              <label className="text-sm font-medium">School</label>
              <select
                name="schoolId"
                defaultValue={params.schoolId ?? ""}
                className="mt-1 h-10 rounded-lg border border-border bg-surface px-3 text-sm block"
              >
                <option value="">All schools</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="h-10 px-4 rounded-lg bg-primary text-white text-sm">
              Filter
            </button>
          </form>
        )}
        <form method="GET" className="flex gap-2 items-end">
          {params.schoolId && <input type="hidden" name="schoolId" value={params.schoolId} />}
          <div>
            <label className="text-sm font-medium">Entity</label>
            <input
              name="entity"
              defaultValue={params.entity ?? ""}
              placeholder="e.g. Student, Invoice"
              className="mt-1 h-10 rounded-lg border border-border bg-surface px-3 text-sm block"
            />
          </div>
          <button type="submit" className="h-10 px-4 rounded-lg bg-primary text-white text-sm">
            Filter
          </button>
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No audit entries found.</p>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-3 text-sm flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {log.action} · {log.entity}
                      {log.entityId ? ` (${log.entityId.slice(0, 8)}…)` : ""}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {log.user
                        ? `${log.user.firstName} ${log.user.lastName} · ${log.user.email}`
                        : "System"}
                      {" · "}
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                  <Badge variant="secondary">{log.action}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex gap-2 justify-center">
          {page > 1 && (
            <Link
              href={`/admin/audit?page=${page - 1}${params.schoolId ? `&schoolId=${params.schoolId}` : ""}${params.entity ? `&entity=${encodeURIComponent(params.entity)}` : ""}`}
              className="text-sm text-primary hover:underline"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-muted">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link
              href={`/admin/audit?page=${page + 1}${params.schoolId ? `&schoolId=${params.schoolId}` : ""}${params.entity ? `&entity=${encodeURIComponent(params.entity)}` : ""}`}
              className="text-sm text-primary hover:underline"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
