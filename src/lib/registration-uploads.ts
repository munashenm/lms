import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function saveRegistrationFile(opts: {
  schoolId: string;
  folder: string;
  file: File;
}): Promise<{ url: string; filename: string; mimeType: string; fileSize: number }> {
  const bytes = await opts.file.arrayBuffer();
  const uploadsDir = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "public",
    "uploads",
    opts.schoolId,
    opts.folder
  );
  await mkdir(uploadsDir, { recursive: true });
  const safeName = opts.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  await writeFile(path.join(uploadsDir, filename), Buffer.from(bytes));
  return {
    url: `/uploads/${opts.schoolId}/${opts.folder}/${filename}`,
    filename: opts.file.name,
    mimeType: opts.file.type || "",
    fileSize: opts.file.size,
  };
}
