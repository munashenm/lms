import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LeaveRequestForm } from "@/components/hr/leave-request-form";
import { LeaveReview } from "@/components/hr/leave-review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { remainingLeaveDays } from "@/lib/leave-entitlement";
import { hrPayrollGate } from "@/components/hr/hr-payroll-gate";

export default async function StaffLeavePage() {
  const blocked = await hrPayrollGate();
  if (blocked) return blocked;
  const session = await getSession();

  const [leaveRequests, employee] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { userId: session!.userId },
      include: {
        applicant: { select: { firstName: true, lastName: true, role: true, email: true } },
        teacher: { select: { firstName: true, lastName: true, employeeNumber: true, department: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.employee.findFirst({
      where: { userId: session!.userId, ...(session!.schoolId ? { schoolId: session!.schoolId } : {}) },
      include: { leaveEntitlements: { include: { leavePolicy: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Leave</h1>
        <p className="text-muted text-sm mt-1">
          Apply for leave and upload a sick note for medical absences. Remaining days come from configured policies.
        </p>
      </div>
      {employee && employee.leaveEntitlements.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Remaining balances</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {employee.leaveEntitlements.map((row) => (
              <p key={row.id}>
                {row.leavePolicy.name}:{" "}
                <span className="font-medium">
                  {remainingLeaveDays({
                    openingBalance: Number(row.openingBalance),
                    accrued: Number(row.accrued),
                    taken: Number(row.taken),
                  })}{" "}
                  day(s)
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <LeaveRequestForm />
      <LeaveReview leaveRequests={leaveRequests} />
    </div>
  );
}
