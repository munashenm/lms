import path from "path";
import { putSchoolUpload } from "@/lib/uploads/storage";

export const HOMEWORK_MAX_BYTES = 10 * 1024 * 1024;
export const PORTAL_UPLOAD_MAX_BYTES = HOMEWORK_MAX_BYTES;

const ALLOWED_EXT = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".zip",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export type PortalUploadFolder = "submissions" | "leave" | "messages" | "homework";

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
  /** When set, nests under folder/{nestUnderId}/ for ownership ACL. */
  nestUnderId?: string;
}): Promise<string> {
  if (opts.file.size > PORTAL_UPLOAD_MAX_BYTES) {
    throw new Error("File must be under 10 MB");
  }
  if (!isAllowedHomeworkFile(opts.file)) {
    throw new Error("Upload a PDF, Office, ZIP, or image file");
  }

  const bytes = await opts.file.arrayBuffer();
  const relativeParts = opts.nestUnderId
    ? [opts.folder, opts.nestUnderId]
    : [opts.folder];
  const safeName = opts.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  return putSchoolUpload({
    schoolId: opts.schoolId,
    relativePath: `${relativeParts.join("/")}/${filename}`,
    body: Buffer.from(bytes),
    contentType: opts.file.type || "application/octet-stream",
  });
}

export async function saveHomeworkSubmissionFile(
  schoolId: string,
  studentId: string,
  file: File
): Promise<string> {
  if (file.size > PORTAL_UPLOAD_MAX_BYTES) {
    throw new Error("File must be under 10 MB");
  }
  if (!isAllowedHomeworkFile(file)) {
    throw new Error("Upload a PDF, Office, ZIP, or image file");
  }
  const bytes = await file.arrayBuffer();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  return putSchoolUpload({
    schoolId,
    relativePath: `submissions/${studentId}/${filename}`,
    body: Buffer.from(bytes),
    contentType: file.type || "application/octet-stream",
  });
}
