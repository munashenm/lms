import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref")?.trim();
  if (!ref) {
    return NextResponse.json({ message: "Reference number required" }, { status: 400 });
  }

  const application = await prisma.application.findFirst({
    where: { referenceNo: { equals: ref, mode: "insensitive" } },
    include: { school: { select: { name: true } } },
  });

  if (!application) {
    return NextResponse.json({ message: "Application not found" }, { status: 404 });
  }

  return NextResponse.json({
    application: {
      referenceNo: application.referenceNo,
      firstName: application.firstName,
      lastName: application.lastName,
      status: application.status,
      gradeApplied: application.gradeApplied,
      courseApplied: application.courseApplied,
      submittedAt: application.submittedAt.toISOString(),
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
      schoolName: application.school.name,
    },
  });
}
