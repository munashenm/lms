export const REGISTRATION_DOC_MAX_BYTES = 10 * 1024 * 1024;
export const STUDENT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const REGISTRATION_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const STUDENT_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export const REGISTRATION_DOC_ACCEPT =
  ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

export const STUDENT_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

const DOC_EXT = new Set([".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp"]);
const PHOTO_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export type RegistrationFileInput = {
  name: string;
  size: number;
  type?: string | null;
};

export const STUDENT_DOCUMENT_LABELS: Record<string, string> = {
  BIRTH_CERTIFICATE: "Birth certificate",
  ID_PASSPORT: "ID / passport",
  PAST_RESULTS: "Past results",
  OTHER: "Other",
};

export const EMPLOYEE_DOCUMENT_LABELS: Record<string, string> = {
  ID_PASSPORT: "ID / passport",
  CONTRACT: "Employment contract",
  QUALIFICATION: "Qualification",
  CERTIFICATE: "Certificate",
  CV: "Curriculum vitae",
  DISCIPLINARY: "Disciplinary",
  POLICY_ACK: "Policy acknowledgement",
  OTHER: "Other",
};

export const STUDENT_REGISTRATION_DOC_SLOTS = [
  { type: "BIRTH_CERTIFICATE", title: "Birth certificate", name: "doc_BIRTH_CERTIFICATE" },
  { type: "ID_PASSPORT", title: "ID / passport", name: "doc_ID_PASSPORT" },
  { type: "PAST_RESULTS", title: "Past results", name: "doc_PAST_RESULTS" },
  { type: "OTHER", title: "Other document", name: "doc_OTHER" },
] as const;

export const EMPLOYEE_REGISTRATION_DOC_SLOTS = [
  { type: "ID_PASSPORT", title: "ID / passport", name: "doc_ID_PASSPORT" },
  { type: "CONTRACT", title: "Employment contract", name: "doc_CONTRACT" },
  { type: "QUALIFICATION", title: "Qualification", name: "doc_QUALIFICATION" },
  { type: "CV", title: "Curriculum vitae", name: "doc_CV" },
  { type: "CERTIFICATE", title: "Certificate", name: "doc_CERTIFICATE" },
  { type: "OTHER", title: "Other document", name: "doc_OTHER" },
] as const;

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function isAllowedRegistrationDocument(file: RegistrationFileInput): boolean {
  if (DOC_EXT.has(fileExtension(file.name))) return true;
  return Boolean(file.type && REGISTRATION_DOC_TYPES.includes(file.type));
}

export function isAllowedStudentPhoto(file: RegistrationFileInput): boolean {
  if (PHOTO_EXT.has(fileExtension(file.name))) return true;
  return Boolean(file.type && STUDENT_PHOTO_TYPES.includes(file.type));
}

export function validateRegistrationDocument(file: RegistrationFileInput | null): string | null {
  if (!file) return "File required";
  if (file.size > REGISTRATION_DOC_MAX_BYTES) return "Document must be under 10 MB";
  if (!isAllowedRegistrationDocument(file)) {
    return "Upload a PDF, Word document, or image (JPG, PNG, WebP)";
  }
  return null;
}

export function validateStudentPhoto(file: RegistrationFileInput | null): string | null {
  if (!file) return "Photo required";
  if (file.size > STUDENT_PHOTO_MAX_BYTES) return "Photo must be under 5 MB";
  if (!isAllowedStudentPhoto(file)) return "Upload a JPG, PNG or WebP photo";
  return null;
}

export function registrationFilesFromForm(
  form: FormData,
  slots: readonly { type: string; title: string; name: string }[]
): Array<{ file: File; type: string; title: string }> {
  const out: Array<{ file: File; type: string; title: string }> = [];
  for (const slot of slots) {
    const value = form.get(slot.name);
    if (typeof File !== "undefined" && value instanceof File && value.size > 0) {
      const customTitle = String(form.get(`${slot.name}_title`) ?? "").trim();
      out.push({ file: value, type: slot.type, title: customTitle || slot.title });
    }
  }
  return out;
}

export function photoFileFromForm(form: FormData): File | null {
  const value = form.get("photo");
  if (typeof File !== "undefined" && value instanceof File && value.size > 0) return value;
  return null;
}

export async function postMultipart(
  url: string,
  fields: Record<string, string | Blob>
): Promise<{ ok: boolean; message?: string }> {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, value);
  }
  const res = await fetch(url, { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) return { ok: false, message: data.message || "Upload failed" };
  return { ok: true };
}
