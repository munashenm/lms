import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import {
  drawBrandedBannerHeader,
  drawBrandedFooter,
  brandPrimaryRgb,
  formatSchoolAddress,
  type SchoolBrand,
} from "./pdf-branding";

export function wrapPdfLines(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.replace(/\r/g, "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function defaultLetterBody(opts: {
  type: string;
  schoolName: string;
  studentName: string;
  studentNumber: string;
  grade?: string;
  destinationSchool?: string | null;
  reason?: string | null;
}): string {
  const grade = opts.grade ? ` in ${opts.grade}` : "";
  if (opts.type === "TRANSFER") {
    const dest = opts.destinationSchool ? ` to ${opts.destinationSchool}` : "";
    return `${opts.schoolName} confirms that ${opts.studentName} (admission no. ${opts.studentNumber}) is/was enrolled${grade}. This letter is issued to support transfer${dest}.${opts.reason ? ` Reason: ${opts.reason}.` : ""} The learner may be admitted subject to the receiving school's own requirements.`;
  }
  if (opts.type === "TESTIMONIAL") {
    return `${opts.schoolName} certifies that ${opts.studentName} (admission no. ${opts.studentNumber}) is/was a registered learner${grade}. During their time at the school they conducted themselves in a manner consistent with our code of conduct. We recommend them for further study.`;
  }
  if (opts.type === "LEAVING") {
    return `This confirms that ${opts.studentName} (admission no. ${opts.studentNumber}) has left ${opts.schoolName}${grade}.${opts.reason ? ` Reason for leaving: ${opts.reason}.` : ""} This letter may be presented to another institution as proof of enrolment.`;
  }
  if (opts.type === "FEE_CLEARANCE") {
    return `${opts.schoolName} confirms that school fees for ${opts.studentName} (admission no. ${opts.studentNumber}) have been paid in full as at the date of this letter. Official reports, certificates and related documents may be released.`;
  }
  if (opts.type === "ENROLMENT") {
    return `${opts.schoolName} confirms that ${opts.studentName} (admission no. ${opts.studentNumber}) is a registered learner${grade}. This letter may be presented as proof of enrolment.`;
  }
  return `${opts.schoolName} issues this official letter in respect of ${opts.studentName} (admission no. ${opts.studentNumber}).`;
}

export type LetterPdfData = {
  brand: SchoolBrand;
  title: string;
  letterNo: string;
  studentName: string;
  studentNumber: string;
  studentNumberLabel?: string;
  grade?: string;
  body: string;
  issuedAt: string;
  effectiveDate: string;
  destinationSchool?: string | null;
};

export async function generateLetterPdf(data: LetterPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();
  const maxWidth = width - 100;

  let y = await drawBrandedBannerHeader({
    doc,
    page,
    brand: data.brand,
    title: data.title,
    font,
    fontBold,
  });

  const write = (text: string, size: number, bold = false) => {
    page.drawText(text, {
      x: 50,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.2),
    });
    y -= size + 8;
  };

  write(data.issuedAt, 10);
  write(`Ref: ${data.letterNo}`, 9);
  if (data.destinationSchool) write(`To: The Principal, ${data.destinationSchool}`, 11, true);
  else write("To whom it may concern", 11, true);
  y -= 6;
  write(`${data.studentNumberLabel ?? "Admission No"}: ${data.studentNumber}`, 10);
  if (data.grade) write(`Grade / programme: ${data.grade}`, 10);
  write(`Effective: ${data.effectiveDate}`, 10);
  y -= 8;

  for (const paragraph of data.body.split(/\n+/)) {
    for (const line of wrapPdfLines(font, paragraph, 11, maxWidth)) {
      if (y < 80) break;
      write(line, 11);
    }
    y -= 6;
  }

  y -= 16;
  write("Yours faithfully", 11);
  y -= 36;
  page.drawLine({
    start: { x: 50, y: y + 10 },
    end: { x: 220, y: y + 10 },
    thickness: 0.7,
    color: rgb(0.55, 0.55, 0.6),
  });
  write(data.brand.name, 12, true);
  const address = formatSchoolAddress(data.brand);
  if (address) write(address, 9);
  page.drawText("Official stamp", {
    x: 388,
    y: 92,
    size: 8,
    font,
    color: brandPrimaryRgb(data.brand),
  });
  page.drawRectangle({
    x: 360,
    y: 86,
    width: 140,
    height: 56,
    borderColor: brandPrimaryRgb(data.brand),
    borderWidth: 0.7,
  });
  drawBrandedFooter({ page, brand: data.brand, font, y: 36 });
  return doc.save();
}
