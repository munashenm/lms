import { SmsConsole } from "@/components/comms/sms-console";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminSmsPage() {
  const session = await getSession();
  const schoolId = session?.schoolId;
  const [classes, grades] = schoolId
    ? await Promise.all([
        prisma.class.findMany({
          where: { schoolId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.grade.findMany({
          where: { schoolId, isActive: true },
          select: { id: true, name: true },
          orderBy: { sortOrder: "asc" },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SMS</h1>
        <p className="text-muted text-sm mt-1">
          Send SMS through the configured gateway and review delivery history. Configure the provider under Settings → Integrations.
        </p>
      </div>
      <SmsConsole classes={classes} grades={grades} />
    </div>
  );
}
