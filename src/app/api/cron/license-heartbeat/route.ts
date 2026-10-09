import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { runDueLicenseHeartbeats } from "@/lib/licensing/run-heartbeat";

/** Manual and operational trigger. The daily run is the in-process scheduler. */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const schoolId = request.nextUrl.searchParams.get("schoolId");
  const summary = await runDueLicenseHeartbeats(schoolId);
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
