import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  buildStudentCardResponse,
  resolvePortalCardStudentId,
} from "@/lib/student-card";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const requestedId = request.nextUrl.searchParams.get("studentId");
  const resolved = await resolvePortalCardStudentId(session, requestedId);
  if (!resolved.ok) {
    return NextResponse.json({ message: resolved.message }, { status: resolved.status });
  }

  const built = await buildStudentCardResponse({
    studentId: resolved.studentId,
    session,
  });
  if (!built) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  await logAudit({
    schoolId: built.student.schoolId,
    userId: session.userId,
    action: "READ",
    entity: "StudentCard",
    entityId: built.student.id,
    metadata: { studentNumber: built.student.studentNumber, via: "me" },
  });

  return new NextResponse(Buffer.from(built.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="student-card-${built.student.studentNumber}.pdf"`,
    },
  });
}
