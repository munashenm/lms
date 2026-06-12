import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface CertificateData {
  schoolName: string;
  studentName: string;
  studentNumber: string;
  title: string;
  type: string;
  courseName?: string;
  academicYear?: string;
  description?: string;
  certificateNo: string;
  issuedAt: string;
}

export async function generateCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 landscape
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  // Border
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: rgb(0.11, 0.3, 0.43),
    borderWidth: 3,
  });
  page.drawRectangle({
    x: 40,
    y: 40,
    width: width - 80,
    height: height - 80,
    borderColor: rgb(0.85, 0.65, 0.13),
    borderWidth: 1,
  });

  let y = height - 100;

  const drawCentered = (text: string, size: number, bold = false, color = rgb(0.1, 0.1, 0.2)) => {
    const f = bold ? fontBold : font;
    const textWidth = f.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y,
      size,
      font: f,
      color,
    });
    y -= size + 12;
  };

  drawCentered(data.schoolName, 22, true, rgb(0.11, 0.3, 0.43));
  drawCentered("CERTIFICATE OF " + data.type.replace("_", " "), 11, false, rgb(0.4, 0.4, 0.4));
  y -= 20;
  drawCentered("This is to certify that", 12);
  y -= 8;
  drawCentered(data.studentName, 28, true, rgb(0.11, 0.3, 0.43));
  drawCentered(`Student No: ${data.studentNumber}`, 10, false, rgb(0.4, 0.4, 0.4));
  y -= 16;
  drawCentered(`has been awarded`, 12);
  drawCentered(data.title, 18, true);
  if (data.courseName) drawCentered(`Programme: ${data.courseName}`, 11);
  if (data.academicYear) drawCentered(`Academic Year: ${data.academicYear}`, 11);
  if (data.description) {
    y -= 10;
    drawCentered(data.description, 10, false, rgb(0.3, 0.3, 0.3));
  }

  y = 80;
  drawCentered(`Certificate No: ${data.certificateNo}`, 9, false, rgb(0.5, 0.5, 0.5));
  drawCentered(`Issued: ${data.issuedAt}`, 9, false, rgb(0.5, 0.5, 0.5));

  return doc.save();
}

export const CERTIFICATE_TYPE_LABELS: Record<string, string> = {
  COMPLETION: "Completion",
  GRADUATION: "Graduation",
  MERIT: "Merit",
  ATTENDANCE: "Attendance",
};
