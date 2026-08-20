import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  drawBrandedBannerHeader,
  drawBrandedFooter,
  brandPrimaryRgb,
  type SchoolBrand,
} from "./pdf-branding";

export interface InvoicePdfLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoicePdfData {
  brand: SchoolBrand;
  invoiceNumber: string;
  statusLabel: string;
  description?: string | null;
  studentName: string;
  studentNumber: string;
  studentNumberLabel?: string;
  gradeOrProgramme?: string | null;
  issuedAt: string;
  dueDate?: string | null;
  generatedAt?: string;
  schoolDetails?: string[];
  lineItems: InvoicePdfLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  outstanding: number;
  collections?: Array<{
    paidAt: string;
    methodLabel: string;
    receiptNumber: string;
    amount: number;
  }>;
}

function money(n: number): string {
  return `R${Math.abs(n).toFixed(2)}`;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();

  let y = await drawBrandedBannerHeader({
    doc,
    page,
    brand: data.brand,
    title: "Tax Invoice / Fee Invoice",
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

  line(`Invoice: ${data.invoiceNumber}`, true, 14);
  line(`Status: ${data.statusLabel}`);
  line(`Issued: ${data.issuedAt}`);
  if (data.dueDate) line(`Due date: ${data.dueDate}`);
  if (data.generatedAt) line(`Printed: ${data.generatedAt}`);
  y -= 6;

  const schoolLines = (data.schoolDetails ?? []).filter(Boolean);
  if (schoolLines.length > 0) {
    line("Issuing school", true, 11);
    for (const row of schoolLines) line(row);
    y -= 6;
  }

  line(`Bill to: ${data.studentName}`, true, 11);
  line(`${data.studentNumberLabel ?? "Admission No"}: ${data.studentNumber}`);
  if (data.gradeOrProgramme) line(`Grade / Programme: ${data.gradeOrProgramme}`);
  if (data.description) {
    y -= 4;
    line(`Description: ${data.description}`);
  }

  y -= 12;
  const cols = [50, 300, 360, 430, 500];
  page.drawText("Description", { x: cols[0], y, size: 9, font: fontBold, color: brandPrimaryRgb(data.brand) });
  page.drawText("Qty", { x: cols[1], y, size: 9, font: fontBold, color: brandPrimaryRgb(data.brand) });
  page.drawText("Unit", { x: cols[2], y, size: 9, font: fontBold, color: brandPrimaryRgb(data.brand) });
  page.drawText("Amount", { x: cols[3], y, size: 9, font: fontBold, color: brandPrimaryRgb(data.brand) });
  y -= 6;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 0.8,
    color: rgb(0.8, 0.8, 0.82),
  });
  y -= 14;

  for (const item of data.lineItems.slice(0, 28)) {
    if (y < 140) break;
    page.drawText(item.description.slice(0, 42), {
      x: cols[0],
      y,
      size: 9,
      font,
      color: rgb(0.15, 0.15, 0.2),
    });
    page.drawText(String(item.quantity), {
      x: cols[1],
      y,
      size: 9,
      font,
      color: rgb(0.15, 0.15, 0.2),
    });
    page.drawText(money(item.unitPrice), {
      x: cols[2],
      y,
      size: 9,
      font,
      color: rgb(0.15, 0.15, 0.2),
    });
    page.drawText(money(item.amount), {
      x: cols[3],
      y,
      size: 9,
      font,
      color: rgb(0.15, 0.15, 0.2),
    });
    y -= 14;
  }

  y -= 8;
  page.drawLine({
    start: { x: 300, y: y + 8 },
    end: { x: width - 50, y: y + 8 },
    thickness: 0.6,
    color: rgb(0.8, 0.8, 0.82),
  });

  const totals: [string, string, boolean?][] = [
    ["Subtotal", money(data.subtotal)],
  ];
  if (data.discount > 0) {
    totals.push(["Discount", `-${money(data.discount)}`]);
  }
  totals.push(["Total", money(data.total), true]);
  totals.push(["Amount paid", money(data.amountPaid)]);
  totals.push([
    "Outstanding",
    data.outstanding > 0 ? money(data.outstanding) : "Paid in full",
    true,
  ]);

  for (const [label, value, bold] of totals) {
    page.drawText(label, {
      x: 320,
      y,
      size: bold ? 11 : 10,
      font: bold ? fontBold : font,
      color: rgb(0.15, 0.15, 0.2),
    });
    page.drawText(value, {
      x: 430,
      y,
      size: bold ? 11 : 10,
      font: bold ? fontBold : font,
      color: brandPrimaryRgb(data.brand),
    });
    y -= bold ? 16 : 14;
  }

  const collections = data.collections ?? [];
  if (collections.length > 0 && y > 160) {
    y -= 10;
    line("Fees collected", true, 11);
    page.drawText("Date / time", { x: 50, y, size: 8, font: fontBold, color: brandPrimaryRgb(data.brand) });
    page.drawText("Method", { x: 200, y, size: 8, font: fontBold, color: brandPrimaryRgb(data.brand) });
    page.drawText("Receipt", { x: 320, y, size: 8, font: fontBold, color: brandPrimaryRgb(data.brand) });
    page.drawText("Amount", { x: 430, y, size: 8, font: fontBold, color: brandPrimaryRgb(data.brand) });
    y -= 12;
    for (const row of collections.slice(0, 12)) {
      if (y < 70) break;
      page.drawText(row.paidAt.slice(0, 22), { x: 50, y, size: 8, font, color: rgb(0.15, 0.15, 0.2) });
      page.drawText(row.methodLabel.slice(0, 18), { x: 200, y, size: 8, font, color: rgb(0.15, 0.15, 0.2) });
      page.drawText(row.receiptNumber.slice(0, 18), { x: 320, y, size: 8, font, color: rgb(0.15, 0.15, 0.2) });
      page.drawText(money(row.amount), { x: 430, y, size: 8, font, color: rgb(0.15, 0.15, 0.2) });
      y -= 12;
    }
  }

  drawBrandedFooter({ page, brand: data.brand, font, y: 42 });

  return doc.save();
}
