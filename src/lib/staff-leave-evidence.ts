/** Stored on LeaveRequest.sickNoteUrl / sickNoteFilename — reused for all leave types. */
export const LEAVE_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const SICK_NOTE_MAX_BYTES = LEAVE_EVIDENCE_MAX_BYTES;

export const LEAVE_EVIDENCE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const SICK_NOTE_TYPES = LEAVE_EVIDENCE_TYPES;

export const LEAVE_EVIDENCE_ACCEPT =
  ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

const LEAVE_EVIDENCE_EXT = new Set([".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp"]);

export type LeaveEvidenceInput = {
  name: string;
  size: number;
  type?: string | null;
};

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function leaveEvidenceRequired(type: string): boolean {
  return type === "SICK";
}

export function isAllowedLeaveEvidence(file: LeaveEvidenceInput): boolean {
  if (LEAVE_EVIDENCE_EXT.has(fileExtension(file.name))) return true;
  return Boolean(file.type && LEAVE_EVIDENCE_TYPES.includes(file.type));
}

export function validateLeaveEvidence(
  file: LeaveEvidenceInput | null,
  leaveType: string
): string | null {
  if (!file) {
    if (leaveEvidenceRequired(leaveType)) {
      return "Sick leave requires a doctor's note or medical certificate upload";
    }
    return null;
  }
  if (file.size > LEAVE_EVIDENCE_MAX_BYTES) {
    return "Evidence must be under 5 MB";
  }
  if (!isAllowedLeaveEvidence(file)) {
    return "Upload a PDF, Word document, or image (JPG, PNG, WebP)";
  }
  return null;
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

/** Accepts `evidence` (preferred) or `sickNote` (legacy form field). */
export function leaveEvidenceFileFromForm(form: FormData): File | null {
  const evidence = form.get("evidence");
  const sickNote = form.get("sickNote");
  if (isUploadedFile(evidence)) return evidence;
  if (isUploadedFile(sickNote)) return sickNote;
  return null;
}

export function leaveEvidenceLabel(leaveType: string, filename?: string | null): string {
  if (filename?.trim()) return filename;
  return leaveEvidenceRequired(leaveType) ? "Sick note" : "Supporting evidence";
}
