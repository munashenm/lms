import type { ParsedSource, SASamsImporter } from "./types";

export const jsonImporter: SASamsImporter = {
  id: "generic-json",
  label: "Structured JSON export",
  versions: ["generic"],
  detect(filename, mimeType, bytes) {
    if (filename.toLowerCase().endsWith(".json") || mimeType === "application/json") return 90;
    const start = bytes.subarray(0, 32).toString("utf8").trim();
    if (start.startsWith("{") || start.startsWith("[")) return 50;
    return 0;
  },
  async parse(bytes) {
    const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
    const sheets: ParsedSource["sheets"] = [];
    const unrecognised: string[] = [];

    if (Array.isArray(parsed)) {
      sheets.push(arrayToSheet("records", parsed));
    } else if (parsed && typeof parsed === "object") {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          sheets.push(arrayToSheet(key, value));
        } else if (value && typeof value === "object") {
          sheets.push(arrayToSheet(key, [value]));
        } else {
          unrecognised.push(key);
        }
      }
    }

    return { adapterId: this.id, format: "json", sheets, unrecognised };
  },
};

function arrayToSheet(name: string, rows: unknown[]): ParsedSource["sheets"][number] {
  const records = rows.map((row) => flatten(row));
  const headerSet = new Set<string>();
  for (const rec of records) Object.keys(rec).forEach((k) => headerSet.add(k));
  const headers = [...headerSet];
  return { name, headers, rows: records };
}

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (value == null) return {};
  if (typeof value !== "object") {
    return { [prefix || "value"]: String(value) };
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else if (Array.isArray(v)) {
      out[key] = v.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join("; ");
    } else {
      out[key] = v == null ? "" : String(v);
    }
  }
  return out;
}
