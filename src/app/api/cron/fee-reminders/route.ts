import { NextRequest, NextResponse } from "next/server";
import { runFeeReminderRules } from "@/lib/fee-reminder-rules";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const header = request.headers.get("x-cron-secret");
  if (header === secret) return true;

  const query = request.nextUrl.searchParams.get("secret");
  return query === secret;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const schoolId = request.nextUrl.searchParams.get("schoolId") ?? undefined;
  const summary = await runFeeReminderRules({
    schoolId,
    limitPerSchool: 200,
  });

  return NextResponse.json({
    ok: true,
    asOf: new Date().toISOString(),
    summary,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
