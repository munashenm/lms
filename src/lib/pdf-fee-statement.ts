import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import {
  drawBrandedBannerHeader,
  drawBrandedFooter,
  brandPrimaryRgb,
  type SchoolBrand,
} from "./pdf-branding";

export interface FeeStatementLine {
  date: string;
  description: string;
  type: string;
  amount: number;
}

export interface FeeStatementData {
  brand: SchoolBrand;
  studentName: string;
  studentNumber: string;
  studentNumberLabel?: string;
  learnerLabel?: string;
  gradeOrProgramme?: string | null;
  academicYear?: string | null;
  guardianName?: string | null;
  generatedAt: string;
  openingBalance: number;
  balance: number;
  lines: FeeStatementLine[];
}

export interface StatementAccountRow {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}R${Math.abs(n).toFixed(2)}`;
}

export function statementAccountRows(
  lines: FeeStatementLine[],
  openingBalance = 0
): StatementAccountRow[] {
  let running = openingBalance;
  return lines.map((row) => {
    running += row.amount;
    return {
      date: row.date,
      description: row.description,
      debit: row.amount > 0 ? row.amount : 0,
      credit: row.amount < 0 ? Math.abs(row.amount) : 0,
      balance: running,
    };
  });
}

export async function generateFeeStatementPdf(data: FeeStatementData): Promise<Uint8Array> {
  const brand = data.brand;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const rows = statementAccountRows(data.lines, data.openingBalance);

  let page: PDFPage = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = async () => {
    y = await drawBrandedBannerHeader({
      doc,
      page,
      brand,
      title: "Statement of Account",
      font,
      fontBold,
    });
  };

  const ensureSpace = async (needed: number) => {
    if (y - needed >= 70) return;
    drawBrandedFooter({ page, brand, font, y: 42 });
    page = doc.addPage([pageWidth, pageHeight]);
    await drawHeader();
    drawColumnHeadings();
  };

  const drawColumnHeadings = () => {
    page.drawText("Date", { x: 50, y, size: 8, font: fontBold, color: brandPrimaryRgb(brand) });
    page.drawText("Description", { x: 110, y, size: 8, font: fontBold, color: brandPrimaryRgb(brand) });
    page.drawText("Debit", { x: 330, y, size: 8, font: fontBold, color: brandPrimaryRgb(brand) });
    page.drawText("Credit", { x: 400, y, size: 8, font: fontBold, color: brandPrimaryRgb(brand) });
    page.drawText("Balance", { x: 475, y, size: 8, font: fontBold, color: brandPrimaryRgb(brand) });
    y -= 14;
  };

  await drawHeader();

  const line = (text: string, bold = false, size = 10) => {
    page.drawText(text, {
      x: 50,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.2),
    });
    y -= size + 6;
  };

  line(`${data.learnerLabel ?? "Learner"}: ${data.studentName}`, true, 12);
  line(`${data.studentNumberLabel ?? "Admission No"}: ${data.studentNumber}`);
  if (data.gradeOrProgramme) line(`Grade / Programme: ${data.gradeOrProgramme}`);
  if (data.academicYear) line(`Academic Year: ${data.academicYear}`);
  if (data.guardianName) line(`Parent / Guardian: ${data.guardianName}`);
  line(`Generated: ${data.generatedAt}`);
  y -= 8;
  line(`Opening balance: ${money(data.openingBalance)}`, true);
  line(`Amount owing: ${money(data.balance)}`, true, 12);
  y -= 10;
  drawColumnHeadings();

  for (const row of rows) {
    await ensureSpace(12);
    page.drawText(row.date.slice(0, 12), { x: 50, y, size: 8, font, color: rgb(0.2, 0.2, 0.25) });
    page.drawText(row.description.slice(0, 36), {
      x: 110,
      y,
      size: 8,
      font,
      color: rgb(0.2, 0.2, 0.25),
    });
    page.drawText(row.debit ? money(row.debit) : "", {
      x: 330,
      y,
      size: 8,
      font,
      color: rgb(0.2, 0.2, 0.25),
    });
    page.drawText(row.credit ? money(row.credit) : "", {
      x: 400,
      y,
      size: 8,
      font,
      color: rgb(0.2, 0.2, 0.25),
    });
    page.drawText(money(row.balance), { x: 475, y, size: 8, font, color: rgb(0.2, 0.2, 0.25) });
    y -= 12;
  }

  page.drawText("Positive balances are amounts owing. Credits reduce the account.", {
    x: 50,
    y: 68,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.45),
  });
  drawBrandedFooter({ page, brand, font, y: 42 });

  return doc.save();
}
