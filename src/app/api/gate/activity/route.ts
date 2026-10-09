import { NextRequest, NextResponse } from "next/server";
import { requireSchoolPermission } from "@/lib/gate/access";
import { gateEventsForDay, presentEvent, todayKey } from "@/lib/gate/queries";

export async function GET(request: NextRequest) {
  const auth = await requireSchoolPermission("gate:read");
  if ("error" in auth) return auth.error;
  const date = request.nextUrl.searchParams.get("date") || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ message: "Invalid date" }, { status: 400 });
  }
  const events = await gateEventsForDay(auth.schoolId, date);
  return NextResponse.json({ date, events: events.map(presentEvent) });
}
