import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  drawBrandedBannerHeader,
  drawBrandedFooter,
  type SchoolBrand,
} from "./pdf-branding";

export interface PaymentReceiptData {
  brand: SchoolBrand;
  receiptNo: string;
  studentName: string;
  studentNumber: string;
  gradeOrProgramme?: string | null;
  invoiceNumber: string;
  amount: number;
  methodLabel: string;
  reference?: string | null;
  notes?: string | null;
  paidAt: string;
  invoiceTotal: number;
  invoiceAmountPaid: number;
  outstanding: number;
  amountInWords?: string | null;
  receivedBy?: string | null;
}

function money(n: number): string {
  return `R${Math.abs(n).toFixed(2)}`;
}

export async function generatePaymentReceiptPdf(
  data: PaymentReceiptData
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = await drawBrandedBannerHeader({
    doc,
    page,
    brand: data.brand,
    title: "Payment Receipt",
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
    y -= size + 7;
  };

  line(`Receipt No: ${data.receiptNo}`, true, 12);
  line(`Date paid: ${data.paidAt}`);
  y -= 6;
  line(`Received from: ${data.studentName}`, true, 11);
  line(`Student No: ${data.studentNumber}`);
  if (data.gradeOrProgramme) line(`Grade / Programme: ${data.gradeOrProgramme}`);
  y -= 8;

  page.drawRectangle({
    x: 50,
    y: y - 50,
    width: 495,
    height: 62,
    color: rgb(0.94, 0.96, 0.97),
    borderColor: rgb(0.11, 0.3, 0.43),
    borderWidth: 1,
  });
  page.drawText("AMOUNT RECEIVED", {
    x: 66,
    y: y - 22,
    size: 9,
    font,
    color: rgb(0.35, 0.38, 0.42),
  });
  page.drawText(money(data.amount), {
    x: 66,
    y: y - 44,
    size: 22,
    font: fontBold,
    color: rgb(0.11, 0.3, 0.43),
  });
  y -= 78;

  line(`Payment method: ${data.methodLabel}`);
  line(`Invoice: ${data.invoiceNumber}`);
  if (data.reference) line(`Reference: ${data.reference}`);
  if (data.notes) line(`Notes: ${data.notes}`);
  y -= 10;
  line(`Invoice total: ${money(data.invoiceTotal)}`);
  line(`Total paid to date: ${money(data.invoiceAmountPaid)}`);
  line(
    data.outstanding > 0
      ? `Outstanding balance: ${money(data.outstanding)}`
      : "Outstanding balance: Paid in full",
    true,
    11
  );
  if (data.amountInWords) line(`Amount in words: ${data.amountInWords}`);
  if (data.receivedBy) line(`Received by: ${data.receivedBy}`);

  y -= 16;
  page.drawText(
    "This receipt acknowledges payment received by the institution.",
    {
      x: 50,
      y,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.5),
    }
  );

  drawBrandedFooter({ page, brand: data.brand, font, y: 42 });

  return doc.save();
}
