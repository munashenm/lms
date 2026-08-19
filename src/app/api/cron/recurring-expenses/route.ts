import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { generateDueRecurringExpenses } from "@/lib/recurring-expenses";

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const schoolId = request.nextUrl.searchParams.get("schoolId") ?? undefined;
  const summary = await generateDueRecurringExpenses({ schoolId });

  return NextResponse.json({
    ok: true,
    asOf: new Date().toISOString(),
    summary,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
