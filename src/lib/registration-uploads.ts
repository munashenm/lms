import { saveRuntimeUpload } from "./runtime-uploads";

export async function saveRegistrationFile(opts: {
  schoolId: string;
  folder: string;
  file: File;
}): Promise<{ url: string; filename: string; mimeType: string; fileSize: number }> {
  const bytes = await opts.file.arrayBuffer();
  const safeName = opts.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  const url = await saveRuntimeUpload({
    schoolId: opts.schoolId,
    folder: opts.folder,
    filename,
    bytes: Buffer.from(bytes),
  });
  return {
    url,
    filename: opts.file.name,
    mimeType: opts.file.type || "",
    fileSize: opts.file.size,
  };
}
