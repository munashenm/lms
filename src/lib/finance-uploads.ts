import { putSchoolUpload } from "@/lib/uploads/storage";

export const FINANCE_SLIP_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const FINANCE_SLIP_MAX_BYTES = 10 * 1024 * 1024;

export async function saveFinanceSlip(
  schoolId: string,
  folder: "expenses" | "income" | "payments",
  file: File
): Promise<string> {
  if (file.size > FINANCE_SLIP_MAX_BYTES) throw new Error("File must be under 10 MB");
  if (file.type && !FINANCE_SLIP_TYPES.includes(file.type)) {
    throw new Error("Upload a PDF or image (JPG, PNG, WebP)");
  }
  const bytes = await file.arrayBuffer();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  return putSchoolUpload({
    schoolId,
    relativePath: `${folder}/${filename}`,
    body: Buffer.from(bytes),
    contentType: file.type || "application/octet-stream",
  });
}
