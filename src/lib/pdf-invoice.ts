import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  drawBrandedBannerHeader,
  drawBrandedFooter,
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
  lineItems: InvoicePdfLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  outstanding: number;
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
  y -= 6;
  line(`Bill to: ${data.studentName}`, true, 11);
  line(`${data.studentNumberLabel ?? "Admission No"}: ${data.studentNumber}`);
  if (data.gradeOrProgramme) line(`Grade / Programme: ${data.gradeOrProgramme}`);
  if (data.description) {
    y -= 4;
    line(`Description: ${data.description}`);
  }

  y -= 12;
  const cols = [50, 300, 360, 430, 500];
  page.drawText("Description", { x: cols[0], y, size: 9, font: fontBold, color: rgb(0.11, 0.3, 0.43) });
  page.drawText("Qty", { x: cols[1], y, size: 9, font: fontBold, color: rgb(0.11, 0.3, 0.43) });
  page.drawText("Unit", { x: cols[2], y, size: 9, font: fontBold, color: rgb(0.11, 0.3, 0.43) });
  page.drawText("Amount", { x: cols[3], y, size: 9, font: fontBold, color: rgb(0.11, 0.3, 0.43) });
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
      color: rgb(0.11, 0.3, 0.43),
    });
    y -= bold ? 16 : 14;
  }

  drawBrandedFooter({ page, brand: data.brand, font, y: 42 });

  return doc.save();
}
