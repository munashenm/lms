import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface ReportPdfColumn {
  label: string;
  align?: "left" | "right";
  width?: number;
}

export interface ReportPdfOptions {
  schoolName: string;
  title: string;
  subtitle?: string;
  generatedAt: string;
  columns: ReportPdfColumn[];
  rows: string[][];
  summary?: { label: string; value: string }[];
}

export async function generateTableReportPdf(options: ReportPdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const rowHeight = 18;
  const headerHeight = 80;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = () => {
    page.drawRectangle({
      x: 0,
      y: pageHeight - headerHeight,
      width: pageWidth,
      height: headerHeight,
      color: rgb(0.11, 0.3, 0.43),
    });
    page.drawText(options.schoolName, {
      x: margin,
      y: pageHeight - 38,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText(options.title.toUpperCase(), {
      x: margin,
      y: pageHeight - 58,
      size: 11,
      font,
      color: rgb(0.9, 0.9, 0.9),
    });
    y = pageHeight - headerHeight - 24;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  drawHeader();

  if (options.subtitle) {
    page.drawText(options.subtitle, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.35, 0.4),
    });
    y -= 20;
  }

  page.drawText(`Generated: ${options.generatedAt}`, {
    x: margin,
    y,
    size: 9,
    font,
    color: rgb(0.45, 0.45, 0.5),
  });
  y -= 22;

  if (options.summary?.length) {
    ensureSpace(40);
    const chunk = options.summary.map((s) => `${s.label}: ${s.value}`).join("   |   ");
    page.drawText(chunk.slice(0, 120), {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.2),
    });
    y -= 24;
  }

  const colCount = options.columns.length;
  const tableWidth = pageWidth - margin * 2;
  const defaultWidth = tableWidth / colCount;
  const colWidths = options.columns.map((c) => c.width ?? defaultWidth);

  const drawTableHeader = () => {
    ensureSpace(rowHeight + 8);
    let x = margin;
    options.columns.forEach((col, i) => {
      page.drawText(col.label, {
        x: col.align === "right" ? x + colWidths[i]! - font.widthOfTextAtSize(col.label, 9) : x,
        y,
        size: 9,
        font: fontBold,
        color: rgb(0.11, 0.3, 0.43),
      });
      x += colWidths[i]!;
    });
    y -= rowHeight;
    page.drawLine({
      start: { x: margin, y: y + 6 },
      end: { x: pageWidth - margin, y: y + 6 },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.78),
    });
  };

  drawTableHeader();

  for (const row of options.rows) {
    ensureSpace(rowHeight + 4);
    let x = margin;
    row.forEach((cell, i) => {
      const col = options.columns[i];
      const text = String(cell ?? "").slice(0, 48);
      const textWidth = font.widthOfTextAtSize(text, 9);
      page.drawText(text, {
        x: col?.align === "right" ? x + colWidths[i]! - textWidth : x,
        y,
        size: 9,
        font,
        color: rgb(0.15, 0.15, 0.2),
      });
      x += colWidths[i]!;
    });
    y -= rowHeight;
  }

  return doc.save();
}
