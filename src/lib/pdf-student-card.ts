import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  embedSchoolLogo,
  brandAccentRgb,
  brandPrimaryRgb,
  formatSchoolContactLine,
  type SchoolBrand,
} from "./pdf-branding";
import { encodeCode39 } from "./code39";

/** ISO/IEC 7810 ID-1 (CR80) landscape, in PDF points. */
export const CR80_WIDTH = (85.6 / 25.4) * 72;
export const CR80_HEIGHT = (53.98 / 25.4) * 72;

export interface CardFact {
  label: string;
  value: string;
}

export interface StudentCardData {
  brand: SchoolBrand;
  studentName: string;
  studentNumber: string;
  studentNumberLabel?: string;
  cardTitle?: string;
  gradeOrProgramme?: string | null;
  className?: string | null;
  /** Shown only when `facts` is omitted. */
  status?: string | null;
  photoUrl?: string | null;
  validYear?: string | null;
  /** Explicit rows. Staff cards use position and department here. */
  facts?: CardFact[] | null;
  /** Opaque SchoolHub credential. Never a name, ID number, or learner number. */
  scanToken?: string | null;
  qrPng?: Uint8Array | null;
}

const INK = rgb(0.1, 0.13, 0.16);
const MUTED = rgb(0.33, 0.36, 0.4);
const WHITE = rgb(1, 1, 1);

async function embedPhoto(doc: PDFDocument, photoUrl?: string | null) {
  if (!photoUrl) return null;
  return embedSchoolLogo(doc, photoUrl);
}

function cardFacts(data: StudentCardData): CardFact[] {
  if (data.facts && data.facts.length > 0) {
    return data.facts.filter((fact) => fact.value.trim());
  }
  const facts: CardFact[] = [];
  if (data.studentNumber && data.studentNumber !== "—") {
    facts.push({ label: data.studentNumberLabel ?? "No", value: data.studentNumber });
  }
  if (data.gradeOrProgramme) facts.push({ label: "Grade", value: data.gradeOrProgramme });
  if (data.className) facts.push({ label: "Class", value: data.className });
  if (data.validYear) facts.push({ label: "Valid", value: data.validYear });
  return facts;
}

function fitSize(font: PDFFont, text: string, size: number, maxWidth: number, min = 6): number {
  let next = size;
  while (next > min && font.widthOfTextAtSize(text, next) > maxWidth) next -= 0.25;
  return next;
}

function clipText(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let shown = text;
  while (shown.length > 1 && font.widthOfTextAtSize(`${shown}...`, size) > maxWidth) {
    shown = shown.slice(0, -1);
  }
  return shown.length < text.length ? `${shown.trimEnd()}...` : shown;
}

function drawFitted(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; maxWidth: number; min?: number }
) {
  const size = fitSize(opts.font, text, opts.size, opts.maxWidth, opts.min ?? 6);
  page.drawText(clipText(opts.font, text, size, opts.maxWidth), {
    x: opts.x,
    y: opts.y,
    size,
    font: opts.font,
    color: opts.color,
  });
}

function wrapName(font: PDFFont, name: string, size: number, maxWidth: number): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["Card holder"];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === 1) break;
  }
  if (lines.length < 2 && current) lines.push(clipText(font, current, size, maxWidth));
  else if (current && lines.length === 1) {
    lines.push(clipText(font, current, size, maxWidth));
  }
  return lines.slice(0, 2);
}

export async function generateStudentCardPdf(data: StudentCardData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([CR80_WIDTH, CR80_HEIGHT]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const brand = data.brand;
  const ink = brandPrimaryRgb(brand);
  const accent = brandAccentRgb(brand);

  page.drawRectangle({ x: 0, y: 0, width, height, color: WHITE });

  const headerH = 28;
  const footerH = 16;
  page.drawRectangle({ x: 0, y: height - headerH, width, height: headerH, color: ink });
  page.drawRectangle({ x: 0, y: height - headerH - 2.5, width, height: 2.5, color: accent });
  page.drawRectangle({ x: 0, y: 0, width, height: footerH, color: ink });

  const logo = await embedSchoolLogo(doc, brand.logoUrl);
  let titleX = 8;
  if (logo) {
    const box = 18;
    const scale = Math.min(box / logo.width, box / logo.height);
    const lw = logo.width * scale;
    const lh = logo.height * scale;
    const lx = 6;
    const ly = height - headerH + (headerH - lh) / 2;
    page.drawRectangle({ x: lx - 1, y: ly - 1, width: lw + 2, height: lh + 2, color: WHITE });
    page.drawImage(logo, { x: lx, y: ly, width: lw, height: lh });
    titleX = lx + lw + 6;
  }

  drawFitted(page, brand.name, {
    x: titleX,
    y: height - 13,
    size: 8,
    font: fontBold,
    color: WHITE,
    maxWidth: width - titleX - 58,
    min: 6.5,
  });
  drawFitted(page, data.cardTitle ?? "LEARNER IDENTITY CARD", {
    x: titleX,
    y: height - 23,
    size: 6,
    font,
    color: rgb(0.9, 0.93, 0.93),
    maxWidth: width - titleX - 58,
    min: 5.5,
  });

  const mark = "SchoolHub";
  const markSize = 6;
  const markW = fontBold.widthOfTextAtSize(mark, markSize);
  page.drawText(mark, {
    x: width - markW - 8,
    y: height - 16,
    size: markSize,
    font: fontBold,
    color: accent,
  });

  const contact = formatSchoolContactLine(brand);
  if (contact) {
    const contactSize = fitSize(font, contact, 5.5, width - 16, 4.5);
    const contactText = clipText(font, contact, contactSize, width - 16);
    const contactW = font.widthOfTextAtSize(contactText, contactSize);
    page.drawText(contactText, {
      x: (width - contactW) / 2,
      y: 5,
      size: contactSize,
      font,
      color: WHITE,
    });
  }

  const photo = await embedPhoto(doc, data.photoUrl);
  const photoBox = { x: 8, y: footerH + 22, w: 52, h: 64 };
  page.drawRectangle({
    x: photoBox.x,
    y: photoBox.y,
    width: photoBox.w,
    height: photoBox.h,
    color: rgb(0.94, 0.95, 0.96),
    borderColor: rgb(0.8, 0.82, 0.84),
    borderWidth: 0.6,
  });
  if (photo) {
    const scale = Math.min(photoBox.w / photo.width, photoBox.h / photo.height);
    const pw = photo.width * scale;
    const ph = photo.height * scale;
    page.drawImage(photo, {
      x: photoBox.x + (photoBox.w - pw) / 2,
      y: photoBox.y + (photoBox.h - ph) / 2,
      width: pw,
      height: ph,
    });
  } else {
    const initials = data.studentName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
    const label = initials || "?";
    const size = 16;
    const tw = fontBold.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: photoBox.x + (photoBox.w - tw) / 2,
      y: photoBox.y + photoBox.h / 2 - 5,
      size,
      font: fontBold,
      color: ink,
    });
  }

  const qrSize = data.qrPng ? 48 : 0;
  const textX = photoBox.x + photoBox.w + 6;
  const textRight = width - (qrSize ? qrSize + 12 : 8);
  const textW = textRight - textX;
  const nameLines = wrapName(fontBold, data.studentName, 9, textW);
  let y = height - headerH - 14;
  for (const line of nameLines) {
    page.drawText(line, { x: textX, y, size: 9, font: fontBold, color: INK });
    y -= 11;
  }
  y -= 1;
  for (const fact of cardFacts(data).slice(0, 4)) {
    const line = `${fact.label}: ${fact.value}`;
    drawFitted(page, line, { x: textX, y, size: 6.5, font, color: MUTED, maxWidth: textW, min: 5.5 });
    y -= 9;
  }

  if (data.qrPng) {
    const qr = await doc.embedPng(data.qrPng);
    const qx = width - qrSize - 8;
    const qy = footerH + 20;
    page.drawImage(qr, { x: qx, y: qy, width: qrSize, height: qrSize });
    if (data.scanToken) {
      drawFitted(page, data.scanToken, {
        x: qx,
        y: footerH + 6,
        size: 4.5,
        font,
        color: MUTED,
        maxWidth: qrSize,
        min: 3.5,
      });
    }
  }

  if (data.scanToken) {
    const barcodeY = footerH + 3;
    const barcodeW = data.qrPng ? width - qrSize - 24 : width - 16;
    drawCode39Barcode(page, {
      value: data.scanToken,
      x: 8,
      y: barcodeY,
      width: barcodeW,
      height: 14,
    });
  } else {
    page.drawText("Card not issued", {
      x: 8,
      y: footerH + 6,
      size: 6,
      font,
      color: MUTED,
    });
  }

  return doc.save();
}

function drawCode39Barcode(
  page: PDFPage,
  opts: { value: string; x: number; y: number; width: number; height: number }
) {
  const { bits } = encodeCode39(opts.value);
  if (bits.length === 0) return;
  const moduleWidth = opts.width / bits.length;
  let x = opts.x;
  for (const bit of bits) {
    if (bit === "1") {
      page.drawRectangle({
        x,
        y: opts.y,
        width: Math.max(moduleWidth, 0.3),
        height: opts.height,
        color: rgb(0.07, 0.09, 0.15),
      });
    }
    x += moduleWidth;
  }
}
