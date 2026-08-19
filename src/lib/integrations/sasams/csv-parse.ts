export function parseCsv(
  text: string,
  delimiter = ","
): { name: string; headers: string[]; rows: Record<string, string>[] } {
  const rows = parseRecords(text, delimiter);
  if (rows.length === 0) return { name: "Sheet1", headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const data = rows.slice(1).map((cols) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = (cols[i] ?? "").trim();
    });
    return rec;
  });
  return { name: "Sheet1", headers, rows: data.filter((r) => Object.values(r).some(Boolean)) };
}

function parseRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      if (field.endsWith("\r")) field = field.slice(0, -1);
      row.push(field);
      records.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records.filter((r) => r.some((c) => c.trim() !== ""));
}
