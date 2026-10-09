import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { listScheduledJobStatus } from "@/lib/scheduler/status";

export async function GET() {
  const session = await getSession();
  if (session?.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const jobs = await listScheduledJobStatus();
  return NextResponse.json({ jobs });
}
