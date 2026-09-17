import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit, rateLimitedJson } from "@/lib/rate-limit";
import { publicApplicationStatus } from "@/lib/application-public";

export async function GET(request: NextRequest) {
  const ip = clientIp(request.headers);
  const limited = rateLimit({ key: `app-status:${ip}`, limit: 20, windowMs: 15 * 60 * 1000 });
  if (!limited.ok) {
    const body = rateLimitedJson(limited.retryAfterSec);
    return NextResponse.json(body.body, { status: body.status, headers: body.headers });
  }

  const ref = request.nextUrl.searchParams.get("ref")?.trim();
  if (!ref) {
    return NextResponse.json({ message: "Reference number required" }, { status: 400 });
  }

  const application = await prisma.application.findFirst({
    where: { referenceNo: { equals: ref, mode: "insensitive" } },
    select: {
      referenceNo: true,
      status: true,
      submittedAt: true,
      school: { select: { name: true } },
    },
  });

  if (!application) {
    return NextResponse.json({ message: "Application not found" }, { status: 404 });
  }

  return NextResponse.json({
    application: publicApplicationStatus(application),
  });
}
