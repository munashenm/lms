import { parseCsv } from "./csv-parse";
import type { ParsedSource, SASamsImporter } from "./types";

export const csvImporter: SASamsImporter = {
  id: "generic-csv",
  label: "CSV / TSV spreadsheet",
  versions: ["generic"],
  detect(filename, mimeType) {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".csv") || mimeType === "text/csv") return 90;
    if (lower.endsWith(".tsv") || mimeType === "text/tab-separated-values") return 85;
    if (lower.endsWith(".txt")) return 40;
    return 0;
  },
  async parse(bytes, filename) {
    const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
    const delimiter =
      filename.toLowerCase().endsWith(".tsv") || text.split("\n")[0]?.includes("\t") ? "\t" : ",";
    const sheet = parseCsv(text, delimiter);
    return {
      adapterId: this.id,
      format: delimiter === "\t" ? "tsv" : "csv",
      sheets: [sheet],
      unrecognised: [],
    } satisfies ParsedSource;
  },
};
