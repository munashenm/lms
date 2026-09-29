import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runGlobalSearch } from "@/lib/global-search";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await runGlobalSearch(session, q);
  return NextResponse.json({ results, q });
}
