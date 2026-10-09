import { NextRequest, NextResponse } from "next/server";
import { requireSchoolPermission } from "@/lib/gate/access";
import { searchGatePeople } from "@/lib/gate/queries";

export async function GET(request: NextRequest) {
  const auth = await requireSchoolPermission("gate:manual");
  if ("error" in auth) {
    const scan = await requireSchoolPermission("gate:scan");
    if ("error" in scan) return auth.error;
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const people = await searchGatePeople(scan.schoolId, q);
    return NextResponse.json({ people });
  }
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const people = await searchGatePeople(auth.schoolId, q);
  return NextResponse.json({ people });
}
