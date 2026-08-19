import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { accrueSchoolLeaveEntitlements } from "@/lib/leave-entitlement";

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const schoolId = request.nextUrl.searchParams.get("schoolId");
  const schoolIds = schoolId
    ? [schoolId]
    : (await prisma.school.findMany({ where: { isActive: true }, select: { id: true } })).map((s) => s.id);

  const summaries = [];
  for (const id of schoolIds) {
    summaries.push({ schoolId: id, ...(await accrueSchoolLeaveEntitlements({ schoolId: id })) });
  }

  return NextResponse.json({
    ok: true,
    asOf: new Date().toISOString(),
    summaries,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
