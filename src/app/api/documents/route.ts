import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { DocumentType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as DocumentType | null;

  const documents = await prisma.document.findMany({
    where: {
      ...getSchoolFilter(session),
      ...(type && { type }),
      ...(session.role === "STUDENT" && { isPublic: true }),
    },
    include: { uploader: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "classes:write") && session!.role !== "TEACHER") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || null;
  const type = (formData.get("type") as DocumentType) || "LEARNING_MATERIAL";
  const isPublic = formData.get("isPublic") === "true";

  if (!file || !title) {
    return NextResponse.json({ message: "File and title required" }, { status: 400 });
  }

  const schoolId = await requireSchoolId(session!);
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadsDir = path.join(process.cwd(), "public", "uploads", schoolId);
  await mkdir(uploadsDir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  await writeFile(path.join(uploadsDir, filename), buffer);

  const document = await prisma.document.create({
    data: {
      schoolId,
      uploadedBy: session!.userId,
      title,
      description,
      type,
      fileUrl: `/uploads/${schoolId}/${filename}`,
      fileSize: buffer.length,
      mimeType: file.type || null,
      isPublic,
    },
  });

  return NextResponse.json({ document }, { status: 201 });
}
