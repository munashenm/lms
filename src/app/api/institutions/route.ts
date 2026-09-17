import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SYSTEM_MODULES } from "@/lib/modules";

export async function GET() {
  const session = await getSession();
  if (session?.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      institutionType: true,
      isActive: true,
      _count: { select: { users: true, students: true } },
      schoolModules: { select: { moduleKey: true, enabled: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    schools: schools.map((school) => {
      const disabled = school.schoolModules.filter((row) => !row.enabled).map((row) => row.moduleKey);
      return {
        ...school,
        enabledModules: SYSTEM_MODULES.length - disabled.length,
        disabledModules: disabled,
      };
    }),
  });
}
