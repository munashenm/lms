import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool } from "@/lib/rbac";
import { EmployeeRecord } from "@/components/hr/employee-record";
import { visibleEmployeeDocuments } from "@/lib/timesheet-hours";
import { requirePermission } from "@/lib/rbac";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDetailPage({ params }: Params) {
  const session = await getSession();
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      salaryStructures: { orderBy: { effectiveFrom: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      leaveEntitlements: { include: { leavePolicy: true }, orderBy: { cycleYear: "desc" } },
    },
  });
  if (!employee || !session || !canAccessSchool(session, employee.schoolId)) notFound();
  const { bankAccountEnc, ...safe } = employee;
  void bankAccountEnc;
  const isSelf = employee.userId === session.userId;
  const canManage = requirePermission(session, "hr.documents.manage");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Employee record</h1>
        <p className="text-muted text-sm mt-1">Salary history, documents and leave balances. Bank account numbers are never shown in full.</p>
      </div>
      <EmployeeRecord
        employee={safe}
        salaryStructures={employee.salaryStructures}
        documents={visibleEmployeeDocuments(employee.documents, {
          isSelf,
          canManageDocs: canManage,
          canView: requirePermission(session, "hr.view"),
        })}
        entitlements={employee.leaveEntitlements}
      />
    </div>
  );
}
