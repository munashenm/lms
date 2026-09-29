/**
 * Parse Department LURITS XML / text feedback snippets and extract tracking numbers.
 * Supports common Tx* payload shapes without depending on a proprietary SMS UI.
 */

export type LuritsFeedbackRecord = {
  fileType: string;
  entityType: "learner" | "educator" | "unknown";
  saIdNumber?: string;
  admissionNumber?: string;
  employeeNumber?: string;
  luritsNumber?: string;
  firstName?: string;
  lastName?: string;
  raw?: string;
};

export type LuritsApplyResult = {
  matched: number;
  updated: number;
  unmatched: number;
  errors: string[];
};

const TX_HINTS: Record<string, "learner" | "educator"> = {
  Tx4: "learner",
  Tx5: "learner",
  Tx7: "learner",
  Tx9: "learner",
  Tx12: "learner",
  Tx13: "educator",
  Tx14: "educator",
  Tx16: "educator",
};

function detectFileType(filename: string, content: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const fromName = Object.keys(TX_HINTS).find((tx) => base.toUpperCase().includes(tx.toUpperCase()));
  if (fromName) return fromName;
  const fromBody = content.match(/\bTx(4|5|7|9|12|13|14|16)\b/i);
  if (fromBody) return `Tx${fromBody[1]}`;
  return "UNKNOWN";
}

function pick(tag: string, block: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const m = block.match(re);
  const value = m?.[1]?.trim();
  return value || undefined;
}

function parseXmlRecords(content: string, fileType: string): LuritsFeedbackRecord[] {
  const entityType = TX_HINTS[fileType] ?? "unknown";
  const blocks =
    content.match(/<(Learner|Educator|Record|Person)[^>]*>[\s\S]*?<\/\1>/gi) ??
    content.match(/<row[^>]*>[\s\S]*?<\/row>/gi) ??
    [];

  if (blocks.length === 0) {
    // Fallback: attribute-style or flat key lines
    return parseFlatRecords(content, fileType, entityType);
  }

  return blocks.map((block) => ({
    fileType,
    entityType,
    saIdNumber: pick("IDNumber", block) ?? pick("IdNumber", block) ?? pick("SAID", block),
    admissionNumber:
      pick("AdmissionNumber", block) ?? pick("LearnerNumber", block) ?? pick("AdmissionNo", block),
    employeeNumber: pick("EmployeeNumber", block) ?? pick("PersalNumber", block),
    luritsNumber: pick("LURITSNumber", block) ?? pick("LuritsNumber", block) ?? pick("LURITSNo", block),
    firstName: pick("FirstName", block) ?? pick("Name", block),
    lastName: pick("Surname", block) ?? pick("LastName", block),
  }));
}

function parseFlatRecords(
  content: string,
  fileType: string,
  entityType: "learner" | "educator" | "unknown"
): LuritsFeedbackRecord[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(/[,\t|;]/).map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iId = idx(["idnumber", "sa id", "said", "identity"]);
  const iAdm = idx(["admission", "learner number", "student number"]);
  const iEmp = idx(["employee", "persal"]);
  const iLur = idx(["lurits"]);
  const iFirst = idx(["first name", "firstname", "name"]);
  const iLast = idx(["surname", "last name", "lastname"]);

  const out: LuritsFeedbackRecord[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(/[,\t|;]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const record: LuritsFeedbackRecord = { fileType, entityType };
    if (iId >= 0) record.saIdNumber = cols[iId] || undefined;
    if (iAdm >= 0) record.admissionNumber = cols[iAdm] || undefined;
    if (iEmp >= 0) record.employeeNumber = cols[iEmp] || undefined;
    if (iLur >= 0) record.luritsNumber = cols[iLur] || undefined;
    if (iFirst >= 0) record.firstName = cols[iFirst] || undefined;
    if (iLast >= 0) record.lastName = cols[iLast] || undefined;
    if (record.luritsNumber || record.saIdNumber || record.admissionNumber) out.push(record);
  }
  return out;
}

export function parseLuritsFeedback(filename: string, content: string): LuritsFeedbackRecord[] {
  const fileType = detectFileType(filename, content);
  const trimmed = content.trim();
  if (trimmed.startsWith("<") || trimmed.includes("<?xml")) {
    return parseXmlRecords(trimmed, fileType);
  }
  return parseFlatRecords(trimmed, fileType, TX_HINTS[fileType] ?? "unknown");
}

export function matchLearnerForLurits(
  record: LuritsFeedbackRecord,
  learners: Array<{ id: string; saIdNumber: string | null; studentNumber: string }>
): string | null {
  if (record.saIdNumber) {
    const byId = learners.find((l) => l.saIdNumber && l.saIdNumber === record.saIdNumber);
    if (byId) return byId.id;
  }
  if (record.admissionNumber) {
    const byAdm = learners.find((l) => l.studentNumber === record.admissionNumber);
    if (byAdm) return byAdm.id;
  }
  return null;
}

export function matchEducatorForLurits(
  record: LuritsFeedbackRecord,
  educators: Array<{ id: string; saIdNumber: string | null; employeeNumber: string }>
): string | null {
  if (record.saIdNumber) {
    const byId = educators.find((e) => e.saIdNumber && e.saIdNumber === record.saIdNumber);
    if (byId) return byId.id;
  }
  if (record.employeeNumber) {
    const byEmp = educators.find((e) => e.employeeNumber === record.employeeNumber);
    if (byEmp) return byEmp.id;
  }
  return null;
}

export function summariseLuritsApply(params: {
  records: LuritsFeedbackRecord[];
  learnerMatches: number;
  educatorMatches: number;
  updated: number;
}): LuritsApplyResult {
  const withNumber = params.records.filter((r) => r.luritsNumber).length;
  return {
    matched: params.learnerMatches + params.educatorMatches,
    updated: params.updated,
    unmatched: Math.max(0, withNumber - (params.learnerMatches + params.educatorMatches)),
    errors: [],
  };
}