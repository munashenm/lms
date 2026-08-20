import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { symbolLabel } from "./grading";
import {
  drawBrandedBannerHeader,
  drawBrandedFooter,
  brandPrimaryRgb,
  type SchoolBrand,
} from "./pdf-branding";

export type TranscriptPdfData = {
  brand: SchoolBrand;
  studentName: string;
  studentNumber: string;
  studentNumberLabel?: string;
  grade: string;
  className: string;
  academicYear: string;
  letterNo: string;
  issuedAt: string;
  subjects: Array<{ name: string; score: number; maxMarks: number; percentage: number; symbol: string }>;
  overallAverage: number;
  overallSymbol: string;
};

export async function generateTranscriptPdf(data: TranscriptPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();

  let y = await drawBrandedBannerHeader({
    doc,
    page,
    brand: data.brand,
    title: "Academic Transcript",
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
    y -= size + 6;
  };

  write(data.studentName, 14, true);
  write(`${data.studentNumberLabel ?? "Admission No"}: ${data.studentNumber}`, 10);
  write(`Grade: ${data.grade}  |  Class: ${data.className}  |  ${data.academicYear}`, 10);
  write(`Transcript ${data.letterNo}  |  Issued ${data.issuedAt}`, 9);
  y -= 8;

  const cols = [50, 260, 340, 410, 470];
  page.drawText("Subject", { x: cols[0], y, size: 10, font: fontBold, color: brandPrimaryRgb(data.brand) });
  page.drawText("Score", { x: cols[1], y, size: 10, font: fontBold, color: brandPrimaryRgb(data.brand) });
  page.drawText("%", { x: cols[2], y, size: 10, font: fontBold, color: brandPrimaryRgb(data.brand) });
  page.drawText("Symbol", { x: cols[3], y, size: 10, font: fontBold, color: brandPrimaryRgb(data.brand) });
  y -= 6;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 14;

  for (const subject of data.subjects) {
    if (y < 90) break;
    page.drawText(subject.name.slice(0, 42), { x: cols[0], y, size: 9, font });
    page.drawText(`${subject.score}/${subject.maxMarks}`, { x: cols[1], y, size: 9, font });
    page.drawText(`${subject.percentage}%`, { x: cols[2], y, size: 9, font });
    page.drawText(subject.symbol, { x: cols[3], y, size: 9, font: fontBold });
    y -= 16;
  }

  y -= 8;
  write(`Overall average: ${data.overallAverage}% (${data.overallSymbol} — ${symbolLabel(data.overallSymbol)})`, 11, true);
  y -= 8;
  write("This transcript summarises recorded assessment marks. It is not a Department of Basic Education certificate.", 8);

  drawBrandedFooter({ page, brand: data.brand, font, y: 48 });
  return doc.save();
}
