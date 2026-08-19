import { NextRequest } from "next/server";
import { saveSchoolUpload } from "@/lib/homework-upload";

export async function parseAbsenceFields(request: NextRequest): Promise<{
  fields: Record<string, unknown>;
  file: File | null;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    return {
      fields: {
        studentId: String(form.get("studentId") ?? "") || undefined,
        type: form.get("type"),
        fromDate: form.get("fromDate"),
        toDate: form.get("toDate"),
        reason: form.get("reason"),
        documentUrl: String(form.get("documentUrl") ?? "").trim() || undefined,
      },
      file: file instanceof File && file.size > 0 ? file : null,
    };
  }

  const json = (await request.json()) as Record<string, unknown>;
  return { fields: json, file: null };
}

export async function attachAbsenceDocument(opts: {
  schoolId: string;
  ownerId: string;
  file: File | null;
  documentUrl?: string | null;
}): Promise<string | null | undefined> {
  if (opts.file) {
    return saveSchoolUpload({
      schoolId: opts.schoolId,
      folder: "leave",
      file: opts.file,
      ownerId: opts.ownerId,
    });
  }
  return opts.documentUrl;
}
