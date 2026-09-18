import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { unreadMessageCount } from "@/lib/internal-messages";

export async function GET() {
  const session = await getSession();
  if (!session || !requirePermission(session, "messaging.view")) {
    return NextResponse.json({ unread: 0 });
  }
  const unread = await unreadMessageCount(session.userId);
  return NextResponse.json({ unread });
}
