import path from "path";
import { saveRuntimeUpload } from "./runtime-uploads";

export const HOMEWORK_MAX_BYTES = 10 * 1024 * 1024;
export const PORTAL_UPLOAD_MAX_BYTES = HOMEWORK_MAX_BYTES;

const ALLOWED_EXT = new Set([".pdf", ".doc", ".docx", ".txt", ".zip", ".png", ".jpg", ".jpeg"]);

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
]);

export type PortalUploadFolder = "submissions" | "leave";

export function homeworkFileExtension(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ext;
}

export function isAllowedHomeworkFile(file: File): boolean {
  const ext = homeworkFileExtension(file.name);
  if (ALLOWED_EXT.has(ext)) return true;
  return Boolean(file.type && ALLOWED_MIME.has(file.type));
}

export async function saveSchoolUpload(opts: {
  schoolId: string;
  folder: PortalUploadFolder;
  file: File;
  ownerId: string;
}): Promise<string> {
  if (opts.file.size > PORTAL_UPLOAD_MAX_BYTES) {
    throw new Error("File must be under 10 MB");
  }
  if (!isAllowedHomeworkFile(opts.file)) {
    throw new Error("Upload a PDF, Word, text, ZIP, or image file");
  }

  const bytes = await opts.file.arrayBuffer();
  const safeName = opts.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${opts.ownerId.slice(0, 8)}-${safeName}`;
  return saveRuntimeUpload({
    schoolId: opts.schoolId,
    folder: opts.folder,
    filename,
    bytes: Buffer.from(bytes),
  });
}

export async function saveHomeworkSubmissionFile(
  schoolId: string,
  studentId: string,
  file: File
): Promise<string> {
  return saveSchoolUpload({
    schoolId,
    folder: "submissions",
    file,
    ownerId: studentId,
  });
}
