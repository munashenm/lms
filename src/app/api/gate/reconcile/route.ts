import { NextRequest, NextResponse } from "next/server";
import { requireSchoolPermission } from "@/lib/gate/access";
import { reconcileSchema } from "@/lib/gate/schema";
import { reconcileMissingCheckout } from "@/lib/gate/reconcile";

export async function POST(request: NextRequest) {
  const manual = await requireSchoolPermission("gate:manual");
  const auth = "error" in manual ? await requireSchoolPermission("gate:manage") : manual;
  if ("error" in auth) return auth.error;
  const parsed = reconcileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "A reason is required" }, { status: 400 });
  const result = await reconcileMissingCheckout({
    schoolId: auth.schoolId,
    actorId: auth.session.userId,
    gateEventId: parsed.data.gateEventId,
    visitorEntryId: parsed.data.visitorEntryId,
    reason: parsed.data.reason,
  });
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
