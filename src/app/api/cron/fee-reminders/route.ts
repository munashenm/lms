import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { runFeeReminderRules } from "@/lib/fee-reminder-rules";

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
