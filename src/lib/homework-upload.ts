import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const HOMEWORK_MAX_BYTES = 10 * 1024 * 1024;

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

export function homeworkFileExtension(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ext;
}

export function isAllowedHomeworkFile(file: File): boolean {
  const ext = homeworkFileExtension(file.name);
  if (ALLOWED_EXT.has(ext)) return true;
  return Boolean(file.type && ALLOWED_MIME.has(file.type));
}

export async function saveHomeworkSubmissionFile(
  schoolId: string,
  studentId: string,
  file: File
): Promise<string> {
  if (file.size > HOMEWORK_MAX_BYTES) {
    throw new Error("File must be under 10 MB");
  }
  if (!isAllowedHomeworkFile(file)) {
    throw new Error("Upload a PDF, Word, text, ZIP, or image file");
  }

  const bytes = await file.arrayBuffer();
  const uploadsDir = path.join(process.cwd(), "public", "uploads", schoolId, "submissions");
  await mkdir(uploadsDir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${studentId.slice(0, 8)}-${safeName}`;
  await writeFile(path.join(uploadsDir, filename), Buffer.from(bytes));
  return `/uploads/${schoolId}/submissions/${filename}`;
}
