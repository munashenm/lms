import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  drawBrandedBannerHeader,
  drawBrandedFooter,
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
  gradeOrProgramme?: string | null;
  academicYear?: string | null;
  guardianName?: string | null;
  generatedAt: string;
  openingBalance: number;
  balance: number;
  lines: FeeStatementLine[];
}

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}R${Math.abs(n).toFixed(2)}`;
}

export async function generateFeeStatementPdf(data: FeeStatementData): Promise<Uint8Array> {
  const brand = data.brand;
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = await drawBrandedBannerHeader({
    doc,
    page,
    brand,
    title: "School Fee Statement",
    font,
    fontBold,
  });

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

  line(`Student: ${data.studentName}`, true, 12);
  line(`Student No: ${data.studentNumber}`);
  if (data.gradeOrProgramme) line(`Grade / Programme: ${data.gradeOrProgramme}`);
  if (data.academicYear) line(`Academic Year: ${data.academicYear}`);
  if (data.guardianName) line(`Parent / Guardian: ${data.guardianName}`);
  line(`Generated: ${data.generatedAt}`);

  y -= 8;
  line(`Opening balance: ${money(data.openingBalance)}`, true);
  line(`Current balance: ${money(data.balance)}`, true, 12);
  y -= 10;

  page.drawText("Date", { x: 50, y, size: 9, font: fontBold, color: rgb(0.11, 0.3, 0.43) });
  page.drawText("Description", { x: 120, y, size: 9, font: fontBold, color: rgb(0.11, 0.3, 0.43) });
  page.drawText("Type", { x: 360, y, size: 9, font: fontBold, color: rgb(0.11, 0.3, 0.43) });
  page.drawText("Amount", { x: 460, y, size: 9, font: fontBold, color: rgb(0.11, 0.3, 0.43) });
  y -= 14;

  for (const row of data.lines.slice(0, 35)) {
    if (y < 90) break;
    page.drawText(row.date.slice(0, 12), { x: 50, y, size: 8, font, color: rgb(0.2, 0.2, 0.25) });
    page.drawText(row.description.slice(0, 40), {
      x: 120,
      y,
      size: 8,
      font,
      color: rgb(0.2, 0.2, 0.25),
    });
    page.drawText(row.type.slice(0, 12), { x: 360, y, size: 8, font, color: rgb(0.2, 0.2, 0.25) });
    page.drawText(money(row.amount), { x: 460, y, size: 8, font, color: rgb(0.2, 0.2, 0.25) });
    y -= 12;
  }

  page.drawText("Balances are calculated from the student financial ledger.", {
    x: 50,
    y: 68,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.45),
  });
  drawBrandedFooter({ page, brand, font, y: 42 });

  return doc.save();
}
