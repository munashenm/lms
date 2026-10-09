import { NextRequest, NextResponse } from "next/server";
import { requireSchoolPermission } from "@/lib/gate/access";
import { listOnSitePeople, occupancyCounts } from "@/lib/gate/queries";

export async function GET(request: NextRequest) {
  const auth = await requireSchoolPermission("gate:read");
  if ("error" in auth) return auth.error;
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const [counts, live] = await Promise.all([
    occupancyCounts(auth.schoolId),
    listOnSitePeople(auth.schoolId, q),
  ]);
  return NextResponse.json({ counts, ...live });
}
