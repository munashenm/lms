import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  drawBrandedBannerHeader,
  drawBrandedFooter,
  type SchoolBrand,
} from "./pdf-branding";
import { amountInWordsZar } from "./amount-in-words";

export interface PayslipPdfData {
  brand: SchoolBrand;
  payslipNumber: string;
  employeeName: string;
  employeeNumber: string;
  department?: string | null;
  position?: string | null;
  periodLabel: string;
  paymentDate?: string | null;
  paymentReference?: string | null;
  earnings: Array<{ name: string; amount: number }>;
  deductions: Array<{ name: string; amount: number }>;
  employer: Array<{ name: string; amount: number }>;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

function money(n: number): string {
  return `R${Math.abs(n).toFixed(2)}`;
}

export async function generatePayslipPdf(data: PayslipPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = await drawBrandedBannerHeader({
    doc,
    page,
    brand: data.brand,
    title: "Payslip",
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

  line(`Payslip ${data.payslipNumber}`, true, 12);
  line(`Employee: ${data.employeeName}`);
  line(`Employee No: ${data.employeeNumber}`);
  if (data.department) line(`Department: ${data.department}`);
  if (data.position) line(`Position: ${data.position}`);
  line(`Payroll period: ${data.periodLabel}`);
  if (data.paymentDate) line(`Payment date: ${data.paymentDate}`);
  if (data.paymentReference) line(`Payment reference: ${data.paymentReference}`);
  y -= 8;

  const drawSection = (title: string, rows: Array<{ name: string; amount: number }>) => {
    line(title, true, 11);
    if (!rows.length) line("None");
    for (const row of rows) {
      page.drawText(row.name, { x: 50, y, size: 10, font, color: rgb(0.15, 0.15, 0.2) });
      page.drawText(money(row.amount), {
        x: 430,
        y,
        size: 10,
        font,
        color: rgb(0.15, 0.15, 0.2),
      });
      y -= 16;
    }
    y -= 6;
  };

  drawSection("Earnings / allowances", data.earnings);
  drawSection("Deductions", data.deductions);
  drawSection("Employer contributions", data.employer);
  line(`Gross pay: ${money(data.grossPay)}`, true);
  line(`Total deductions: ${money(data.totalDeductions)}`, true);
  line(`Net pay: ${money(data.netPay)}`, true, 12);
  line(`Amount in words: ${amountInWordsZar(data.netPay)}`);

  drawBrandedFooter({ page, brand: data.brand, font, y: 42 });
  return doc.save();
}
