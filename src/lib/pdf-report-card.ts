import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { symbolLabel } from "./grading";
import {
  drawBrandedBannerHeader,
  drawBrandedFooter,
  brandPrimaryRgb,
  type SchoolBrand,
} from "./pdf-branding";

export interface ReportCardSubject {
  name: string;
  score: number;
  maxMarks: number;
  percentage: number;
  symbol: string;
}

export interface ReportCardData {
  brand: SchoolBrand;
  studentName: string;
  studentNumber: string;
  studentNumberLabel?: string;
  learnerLabel?: string;
  grade: string;
  className: string;
  academicYear: string;
  term: string;
  subjects: ReportCardSubject[];
  overallAverage: number;
  overallSymbol: string;
  comments?: string;
}

export async function generateReportCardPdf(data: ReportCardData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width } = page.getSize();
  let y = await drawBrandedBannerHeader({
    doc,
    page,
    brand: data.brand,
    title: "Learner Report Card",
    font,
    fontBold,
  });

  const drawText = (text: string, x: number, size: number, bold = false) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.2),
    });
    y -= size + 6;
  };

  drawText(`${data.learnerLabel ?? "Learner"}: ${data.studentName}`, 50, 12, true);
  drawText(`${data.studentNumberLabel ?? "Admission No"}: ${data.studentNumber}`, 50, 10);
  drawText(`Grade: ${data.grade}  |  Class: ${data.className}`, 50, 10);
  drawText(`Academic Year: ${data.academicYear}  |  Term: ${data.term}`, 50, 10);

  y -= 10;
  const cols = [50, 220, 320, 380, 450];
  page.drawText("Subject", { x: cols[0], y, size: 10, font: fontBold, color: brandPrimaryRgb(data.brand) });
  page.drawText("Score", { x: cols[1], y, size: 10, font: fontBold, color: brandPrimaryRgb(data.brand) });
  page.drawText("%", { x: cols[2], y, size: 10, font: fontBold, color: brandPrimaryRgb(data.brand) });
  page.drawText("Symbol", { x: cols[3], y, size: 10, font: fontBold, color: brandPrimaryRgb(data.brand) });
  y -= 5;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 15;

  for (const sub of data.subjects) {
    page.drawText(sub.name, { x: cols[0], y, size: 9, font });
    page.drawText(`${sub.score}/${sub.maxMarks}`, { x: cols[1], y, size: 9, font });
    page.drawText(`${sub.percentage}%`, { x: cols[2], y, size: 9, font });
    page.drawText(sub.symbol, { x: cols[3], y, size: 9, font: fontBold });
    y -= 16;
  }

  y -= 10;
  page.drawLine({ start: { x: 50, y: y + 5 }, end: { x: width - 50, y: y + 5 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 10;
  drawText(
    `Overall Average: ${data.overallAverage}%  (Symbol ${data.overallSymbol} — ${symbolLabel(data.overallSymbol)})`,
    50,
    11,
    true
  );

  if (data.comments) {
    y -= 5;
    drawText("Comments:", 50, 10, true);
    const words = data.comments.split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (test.length > 80) {
        drawText(line, 50, 9);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) drawText(line, 50, 9);
  }

  drawBrandedFooter({ page, brand: data.brand, font, y: 48 });

  return doc.save();
}
