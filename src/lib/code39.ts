/** Code 39 patterns: 9 elements (bar, space, bar, …). `n` = narrow, `w` = wide. */
const PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

const WIDE_UNITS = 3;

export function sanitizeCode39(value: string): string {
  const next = value
    .toUpperCase()
    .replace(/[^0-9A-Z\-. $/+%]/g, "-")
    .slice(0, 24);
  return next || "-";
}

function patternBits(pattern: string): string {
  let bits = "";
  for (let i = 0; i < pattern.length; i++) {
    const units = pattern[i] === "w" ? WIDE_UNITS : 1;
    bits += (i % 2 === 0 ? "1" : "0").repeat(units);
  }
  return bits;
}

/** Unit-width bar pattern (`1` = bar, `0` = gap), including start/stop `*`. */
export function encodeCode39(value: string): { bits: string; display: string } {
  const display = sanitizeCode39(value);
  const chars = `*${display}*`;
  const parts: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (i > 0) parts.push("0");
    const pattern = PATTERNS[chars[i]] ?? PATTERNS["-"];
    parts.push(patternBits(pattern));
  }
  return { bits: parts.join(""), display };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function code39Svg(
  value: string,
  opts?: { moduleWidth?: number; barHeight?: number }
): string {
  const { bits, display } = encodeCode39(value);
  const moduleWidth = opts?.moduleWidth ?? 1.6;
  const barHeight = opts?.barHeight ?? 40;
  const width = Math.max(bits.length * moduleWidth, 1);
  const height = barHeight + 16;
  const rects: string[] = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== "1") continue;
    rects.push(
      `<rect x="${(i * moduleWidth).toFixed(2)}" y="0" width="${moduleWidth.toFixed(2)}" height="${barHeight}" fill="#111827"/>`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height}" viewBox="0 0 ${width.toFixed(2)} ${height}" role="img" aria-label="Barcode ${escapeXml(display)}">${rects.join("")}<text x="${(width / 2).toFixed(2)}" y="${barHeight + 13}" text-anchor="middle" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#111827">${escapeXml(display)}</text></svg>`;
}
