import { inflateRawSync } from "zlib";
import { parseCsv } from "./csv-parse";
import type { SASamsImporter } from "./types";

/**
 * Minimal XLSX reader for first-sheet tabular data.
 * Confirmed SA-SAMS database layouts are not assumed.
 */
export const xlsxImporter: SASamsImporter = {
  id: "generic-xlsx",
  label: "Excel workbook",
  versions: ["generic"],
  detect(filename, _mime, bytes) {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".xlsx")) return 88;
    if (bytes.subarray(0, 2).toString() === "PK") return 35;
    if (lower.endsWith(".xls")) return 20;
    return 0;
  },
  async parse(bytes, filename) {
    if (filename.toLowerCase().endsWith(".xls") && bytes.subarray(0, 2).toString() !== "PK") {
      throw new Error(
        "Legacy .xls (BIFF) files are not parsed yet. Please save the sheet as .xlsx or CSV and upload again."
      );
    }
    const files = unzip(bytes);
    const shared = parseSharedStrings(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
    const sheetPath =
      [...files.keys()].find((k) => /^xl\/worksheets\/sheet1\.xml$/i.test(k)) ??
      [...files.keys()].find((k) => /xl\/worksheets\/sheet\d+\.xml$/i.test(k));
    if (!sheetPath) {
      throw new Error("No worksheet was found in the Excel file.");
    }
    const grid = parseSheet(files.get(sheetPath)!.toString("utf8"), shared);
    if (grid.length === 0) {
      return { adapterId: this.id, format: "xlsx", sheets: [], unrecognised: [] };
    }
    const csv = grid.map((row) => row.map(csvEscape).join(",")).join("\n");
    const sheet = parseCsv(csv, ",");
    sheet.name = sheetPath.split("/").pop() ?? "Sheet1";
    return { adapterId: this.id, format: "xlsx", sheets: [sheet], unrecognised: [] };
  },
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const uncompSize = buf.readUInt32LE(offset + 22);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    const dataEnd = dataStart + compSize;
    const data = buf.subarray(dataStart, dataEnd);
    if (method === 0) out.set(name, Buffer.from(data));
    else if (method === 8) out.set(name, inflateRawSync(data));
    offset = dataEnd;
    if (uncompSize === 0 && compSize === 0 && name.endsWith("/")) continue;
  }
  return out;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const re = /<si[\s\S]*?<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const texts = [...match[0].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => decodeXml(m[1]));
    out.push(texts.join(""));
  }
  return out;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml))) {
    const cells: string[] = [];
    const cellRe = /<c([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const attrs = cellMatch[1];
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const col = ref ? colIndex(ref) : cells.length;
      const isShared = /\st="s"/.test(attrs);
      const v = /<v>([^<]*)<\/v>/.exec(cellMatch[2])?.[1] ?? "";
      const value = isShared ? shared[Number(v)] ?? "" : decodeXml(v);
      cells[col] = value;
    }
    rows.push(cells.map((c) => c ?? ""));
  }
  return rows;
}

function colIndex(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
