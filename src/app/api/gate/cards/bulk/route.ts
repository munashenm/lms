import { NextRequest, NextResponse } from "next/server";
import { requireSchoolPermission } from "@/lib/gate/access";
import { issueMissingAccessCards, missingCardCounts } from "@/lib/gate/cards";
import { bulkCardSchema } from "@/lib/gate/schema";

export async function GET() {
  const auth = await requireSchoolPermission("cards:manage");
  if ("error" in auth) return auth.error;
  const counts = await missingCardCounts(auth.schoolId);
  return NextResponse.json(counts);
}

export async function POST(request: NextRequest) {
  const auth = await requireSchoolPermission("cards:manage");
  if ("error" in auth) return auth.error;
  const parsed = bulkCardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const result = await issueMissingAccessCards({
    schoolId: auth.schoolId,
    actorId: auth.session.userId,
    holderType: parsed.data.holderType,
    limit: parsed.data.limit ?? 100,
  });
  return NextResponse.json(result);
}
