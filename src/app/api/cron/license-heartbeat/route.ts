import { NextRequest, NextResponse } from "next/server";
import { maybeHeartbeat } from "@/lib/licensing/service";
import { prisma } from "@/lib/db";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (request.headers.get("x-cron-secret") === secret) return true;
  return request.nextUrl.searchParams.get("secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const schoolId = request.nextUrl.searchParams.get("schoolId");
  const schools = schoolId
    ? [{ id: schoolId }]
    : await prisma.school.findMany({ where: { isActive: true }, select: { id: true } });
  const results = [];
  for (const school of schools) {
    const evaluation = await maybeHeartbeat(school.id);
    results.push({ schoolId: school.id, status: evaluation.effectiveStatus, restricted: evaluation.restricted });
  }
  return NextResponse.json({ ok: true, results });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
