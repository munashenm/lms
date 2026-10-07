import path from "path";
import { putSchoolUpload } from "@/lib/uploads/storage";

export async function saveRegistrationFile(opts: {
  schoolId: string;
  folder: string;
  file: File;
}): Promise<{ url: string; filename: string; mimeType: string; fileSize: number }> {
  const bytes = await opts.file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const safeName = opts.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  const folder = opts.folder.replace(/^\/+|\/+$/g, "").replace(/\\/g, "/");
  const relativePath = `${folder}/${filename}`;
  const url = await putSchoolUpload({
    schoolId: opts.schoolId,
    relativePath,
    body: buffer,
    contentType: opts.file.type || "application/octet-stream",
  });
  return {
    url,
    filename: opts.file.name,
    mimeType: opts.file.type || "",
    fileSize: opts.file.size,
  };
}

export function registrationFileExtension(name: string): string {
  return path.extname(name).toLowerCase();
}
