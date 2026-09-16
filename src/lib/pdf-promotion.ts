import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  drawBrandedBannerHeader,
  drawBrandedFooter,
  type SchoolBrand,
} from "./pdf-branding";
import type { PromotionReportRow } from "./promotion";

export async function generatePromotionReportPdf(params: {
  brand: SchoolBrand;
  title: string;
  sessionName: string;
  rows: PromotionReportRow[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [842, 595];
  let page = doc.addPage(pageSize);
  let y = await drawBrandedBannerHeader({
    doc,
    page,
    brand: params.brand,
    title: params.title,
    font,
    fontBold,
    headerHeight: 72,
  });

  const ink = rgb(0.1, 0.1, 0.2);
  const muted = rgb(0.4, 0.42, 0.48);
  const columns = [
    { label: "Learner", x: 36, width: 150 },
    { label: "Result", x: 190, width: 58 },
    { label: "Avg %", x: 252, width: 46 },
    { label: "Att %", x: 302, width: 46 },
    { label: "Eligibility", x: 352, width: 90 },
    { label: "Decision", x: 448, width: 90 },
    { label: "Destination", x: 544, width: 110 },
    { label: "Override", x: 660, width: 140 },
  ];

  page.drawText(`Session: ${params.sessionName}  ·  ${params.rows.length} learner(s)`, {
    x: 36,
    y,
    size: 10,
    font,
    color: muted,
  });
  y -= 18;

  const drawHeader = () => {
    for (const column of columns) {
      page.drawText(column.label, {
        x: column.x,
        y,
        size: 8,
        font: fontBold,
        color: ink,
      });
    }
    y -= 12;
    page.drawLine({
      start: { x: 36, y },
      end: { x: 806, y },
      thickness: 0.6,
      color: rgb(0.8, 0.82, 0.86),
    });
    y -= 10;
  };

  drawHeader();

  for (const row of params.rows) {
    if (y < 64) {
      drawBrandedFooter({ page, brand: params.brand, font });
      page = doc.addPage(pageSize);
      y = await drawBrandedBannerHeader({
        doc,
        page,
        brand: params.brand,
        title: params.title,
        font,
        fontBold,
        headerHeight: 72,
      });
      drawHeader();
    }

    const cells = [
      `${row.learner} (${row.studentNumber})`,
      row.resultStatus,
      row.average == null ? "—" : String(row.average),
      row.attendance == null ? "—" : String(row.attendance),
      row.eligibility,
      row.decision || "Pending",
      row.destination || "—",
      row.overridden ? "Yes" : "",
    ];
    cells.forEach((text, index) => {
      const column = columns[index];
      const clipped = text.length > 32 ? `${text.slice(0, 31)}…` : text;
      page.drawText(clipped, {
        x: column.x,
        y,
        size: 8,
        font,
        color: ink,
      });
    });
    y -= 14;
  }

  drawBrandedFooter({ page, brand: params.brand, font });
  return doc.save();
}
