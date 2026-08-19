import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import {
  drawBrandedFooter,
  embedSchoolLogo,
  type SchoolBrand,
} from "./pdf-branding";
import { encodeCode39 } from "./code39";

export interface StudentCardData {
  brand: SchoolBrand;
  studentName: string;
  studentNumber: string;
  gradeOrProgramme?: string | null;
  className?: string | null;
  status?: string | null;
  photoUrl?: string | null;
  validYear?: string | null;
}

async function embedPhoto(doc: PDFDocument, photoUrl?: string | null) {
  if (!photoUrl) return null;
  return embedSchoolLogo(doc, photoUrl);
}

export async function generateStudentCardPdf(
  data: StudentCardData
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  // CR80-ish landscape card (scaled for printability)
  const page = doc.addPage([504, 318]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const brand = data.brand;

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.97, 0.98, 0.99),
  });
  page.drawRectangle({
    x: 12,
    y: 12,
    width: width - 24,
    height: height - 24,
    borderColor: rgb(0.11, 0.3, 0.43),
    borderWidth: 2,
  });
  page.drawRectangle({
    x: 12,
    y: height - 70,
    width: width - 24,
    height: 58,
    color: rgb(0.11, 0.3, 0.43),
  });

  const logo = await embedSchoolLogo(doc, brand.logoUrl);
  if (logo) {
    const scale = Math.min(40 / logo.height, 56 / logo.width, 1);
    const lw = logo.width * scale;
    const lh = logo.height * scale;
    page.drawImage(logo, {
      x: 28,
      y: height - 28 - lh,
      width: lw,
      height: lh,
    });
  }

  const titleX = logo ? 96 : 28;
  page.drawText(brand.name.slice(0, 42), {
    x: titleX,
    y: height - 40,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("STUDENT IDENTITY CARD", {
    x: titleX,
    y: height - 56,
    size: 9,
    font,
    color: rgb(0.9, 0.9, 0.9),
  });

  const photo = await embedPhoto(doc, data.photoUrl);
  const photoBox = { x: 28, y: 78, w: 90, h: 110 };
  page.drawRectangle({
    x: photoBox.x,
    y: photoBox.y,
    width: photoBox.w,
    height: photoBox.h,
    borderColor: rgb(0.75, 0.78, 0.82),
    borderWidth: 1,
    color: rgb(0.93, 0.94, 0.96),
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
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
    const tw = fontBold.widthOfTextAtSize(initials || "?", 22);
    page.drawText(initials || "?", {
      x: photoBox.x + (photoBox.w - tw) / 2,
      y: photoBox.y + photoBox.h / 2 - 8,
      size: 22,
      font: fontBold,
      color: rgb(0.11, 0.3, 0.43),
    });
  }

  let y = height - 100;
  const infoX = 140;
  page.drawText(data.studentName, {
    x: infoX,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.12, 0.18),
  });
  y -= 22;
  page.drawText(`Student No: ${data.studentNumber}`, {
    x: infoX,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.11, 0.3, 0.43),
  });
  y -= 18;
  if (data.gradeOrProgramme) {
    page.drawText(`Grade / Programme: ${data.gradeOrProgramme}`, {
      x: infoX,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.22, 0.28),
    });
    y -= 16;
  }
  if (data.className) {
    page.drawText(`Class: ${data.className}`, {
      x: infoX,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.22, 0.28),
    });
    y -= 16;
  }
  if (data.status) {
    page.drawText(`Status: ${data.status}`, {
      x: infoX,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.22, 0.28),
    });
    y -= 16;
  }
  if (data.validYear) {
    page.drawText(`Valid for: ${data.validYear}`, {
      x: infoX,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.22, 0.28),
    });
  }

  drawCode39Barcode(page, {
    value: data.studentNumber,
    x: 28,
    y: 44,
    width: width - 56,
    height: 26,
  });

  drawBrandedFooter({
    page,
    brand,
    font,
    y: 22,
    color: rgb(0.4, 0.42, 0.48),
  });

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
        width: Math.max(moduleWidth, 0.4),
        height: opts.height,
        color: rgb(0.07, 0.09, 0.15),
      });
    }
    x += moduleWidth;
  }
}
