import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { scopedId } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { validateStudentPhoto } from "@/lib/registration-docs";
import { saveRegistrationFile } from "@/lib/registration-uploads";
import { canWriteVisitorBook } from "@/lib/visitors";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.schoolId || !canWriteVisitorBook(session)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const policy = await prisma.gatePolicy.findUnique({
    where: { schoolId: session.schoolId },
    select: { allowVisitorPhoto: true },
  });
  if (policy && policy.allowVisitorPhoto === false) {
    return NextResponse.json({ message: "Visitor photos are turned off for this school" }, { status: 403 });
  }
  const { id } = await params;
  const entry = await prisma.visitorEntry.findFirst({ where: scopedId(session, id) });
  if (!entry) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) return NextResponse.json({ message: "Photo file required" }, { status: 400 });
  const invalid = validateStudentPhoto(file);
  if (invalid) return NextResponse.json({ message: invalid }, { status: 400 });

  const saved = await saveRegistrationFile({
    schoolId: entry.schoolId,
    folder: `visitors/${entry.id}`,
    file,
  });
  await prisma.visitorEntry.update({
    where: { id: entry.id },
    data: { photoUrl: saved.url },
  });
  await logAudit({
    schoolId: entry.schoolId,
    userId: session.userId,
    action: "VISITOR_PHOTO_UPLOADED",
    entity: "VisitorEntry",
    entityId: entry.id,
  });
  return NextResponse.json({ photoUrl: saved.url });
}
