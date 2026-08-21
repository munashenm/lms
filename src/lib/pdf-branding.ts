import { readFile } from "fs/promises";
import path from "path";
import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  rgb,
  type RGB,
} from "pdf-lib";
import { hexToPdfRgb, DEFAULT_PRIMARY_COLOR } from "./school-branding";
import { readRuntimeUpload } from "./runtime-uploads";

export type SchoolBrand = {
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  logoUrl?: string | null;
  registrationNo?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankBranchCode?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
};

const WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.45, 0.45, 0.5);

export function brandPrimaryRgb(brand: Pick<SchoolBrand, "primaryColor">): RGB {
  const { r, g, b } = hexToPdfRgb(brand.primaryColor || DEFAULT_PRIMARY_COLOR);
  return rgb(r, g, b);
}

export function toSchoolBrand(school: {
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  logoUrl?: string | null;
  registrationNo?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankBranchCode?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}): SchoolBrand {
  return {
    name: school.name,
    email: school.email,
    phone: school.phone,
    website: school.website,
    address: school.address,
    city: school.city,
    province: school.province,
    postalCode: school.postalCode,
    logoUrl: school.logoUrl,
    registrationNo: school.registrationNo,
    bankName: school.bankName,
    bankAccountName: school.bankAccountName,
    bankAccountNumber: school.bankAccountNumber,
    bankBranchCode: school.bankBranchCode,
    primaryColor: school.primaryColor,
    accentColor: school.accentColor,
  };
}

export function schoolBankingLines(brand: SchoolBrand): string[] {
  return [
    brand.bankName ? `Bank: ${brand.bankName}` : null,
    brand.bankAccountName ? `Account name: ${brand.bankAccountName}` : null,
    brand.bankAccountNumber ? `Account number: ${brand.bankAccountNumber}` : null,
    brand.bankBranchCode ? `Branch code: ${brand.bankBranchCode}` : null,
  ].filter((line): line is string => Boolean(line));
}

export function hasSchoolBanking(brand: SchoolBrand): boolean {
  return schoolBankingLines(brand).length > 0;
}

export function formatSchoolAddress(brand: SchoolBrand): string {
  return [brand.address, brand.city, brand.province, brand.postalCode]
    .filter(Boolean)
    .join(", ");
}

export function formatSchoolContactLine(brand: SchoolBrand): string {
  return [brand.phone, brand.email, brand.website].filter(Boolean).join(" · ");
}

async function resolveLogoBytes(logoUrl: string): Promise<Uint8Array | null> {
  try {
    const local = await readRuntimeUpload(logoUrl);
    if (local) return new Uint8Array(local.bytes);

    if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
      const res = await fetch(logoUrl);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }

    const relative = logoUrl.startsWith("/") ? logoUrl.slice(1) : logoUrl;
    const candidates = [
      path.join(/* turbopackIgnore: true */ process.cwd(), "public", relative),
      path.join(/* turbopackIgnore: true */ process.cwd(), "data", relative),
      path.join(/* turbopackIgnore: true */ process.cwd(), relative),
    ];
    for (const filePath of candidates) {
      try {
        const buf = await readFile(filePath);
        return new Uint8Array(buf);
      } catch {
        /* try the next location */
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function embedSchoolLogo(
  doc: PDFDocument,
  logoUrl?: string | null
): Promise<PDFImage | null> {
  if (!logoUrl) return null;
  const bytes = await resolveLogoBytes(logoUrl);
  if (!bytes) return null;

  try {
    return await doc.embedPng(bytes);
  } catch {
    try {
      return await doc.embedJpg(bytes);
    } catch {
      return null;
    }
  }
}

function fitLogo(image: PDFImage, maxH: number, maxW: number) {
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  return { width: image.width * scale, height: image.height * scale };
}

/** Official letterhead: logo on white, school details, document title, brand colour bars. */
export async function drawBrandedBannerHeader(params: {
  doc: PDFDocument;
  page: PDFPage;
  brand: SchoolBrand;
  title: string;
  font: PDFFont;
  fontBold: PDFFont;
  headerHeight?: number;
}): Promise<number> {
  const { doc, page, brand, title, font, fontBold } = params;
  const headerHeight = Math.max(params.headerHeight ?? 108, 96);
  const { width, height } = page.getSize();
  const top = height - headerHeight;
  const primary = brandPrimaryRgb(brand);
  const ink = rgb(0.12, 0.14, 0.2);

  page.drawRectangle({
    x: 0,
    y: top,
    width,
    height: headerHeight,
    color: WHITE,
  });
  page.drawRectangle({
    x: 0,
    y: height - 5,
    width,
    height: 5,
    color: primary,
  });
  page.drawRectangle({
    x: 0,
    y: top,
    width,
    height: 4,
    color: primary,
  });

  const logo = await embedSchoolLogo(doc, brand.logoUrl);
  let textX = 48;
  if (logo) {
    const size = fitLogo(logo, 58, 92);
    page.drawImage(logo, {
      x: 40,
      y: top + 14 + (headerHeight - 28 - size.height) / 2,
      width: size.width,
      height: size.height,
    });
    textX = 40 + size.width + 14;
  }

  const name = brand.name.slice(0, 52);
  page.drawText(name, {
    x: textX,
    y: height - 34,
    size: 15,
    font: fontBold,
    color: primary,
  });

  let infoY = height - 50;
  const address = formatSchoolAddress(brand);
  if (address) {
    page.drawText(address.slice(0, 92), {
      x: textX,
      y: infoY,
      size: 8,
      font,
      color: MUTED,
    });
    infoY -= 11;
  }
  const contact = formatSchoolContactLine(brand);
  if (contact) {
    page.drawText(contact.slice(0, 92), {
      x: textX,
      y: infoY,
      size: 8,
      font,
      color: MUTED,
    });
    infoY -= 11;
  }
  if (brand.registrationNo) {
    page.drawText(`EMIS / Reg. No: ${brand.registrationNo}`.slice(0, 92), {
      x: textX,
      y: infoY,
      size: 8,
      font,
      color: MUTED,
    });
  }

  const heading = title.toUpperCase();
  const headingSize = heading.length > 28 ? 8 : 10;
  const headingWidth = fontBold.widthOfTextAtSize(heading, headingSize);
  page.drawText(heading, {
    x: Math.max(textX, width - 48 - headingWidth),
    y: top + 14,
    size: headingSize,
    font: fontBold,
    color: ink,
  });

  return top - 22;
}

/** EFT banking block for invoices and fee statements. */
export function drawSchoolBankingBlock(params: {
  page: PDFPage;
  brand: SchoolBrand;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
  paymentReference?: string | null;
  accountNumberLabel?: string;
}): number {
  const { page, brand, font, fontBold } = params;
  const lines = schoolBankingLines(brand);
  const reference = params.paymentReference?.trim();
  if (lines.length === 0 && !reference) return params.y;

  const rowCount = lines.length + (reference ? 2 : 0) + 1;
  const boxHeight = 18 + rowCount * 12;
  let y = params.y;
  const primary = brandPrimaryRgb(brand);

  page.drawRectangle({
    x: 50,
    y: y - boxHeight + 8,
    width: 495,
    height: boxHeight,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: primary,
    borderWidth: 0.8,
  });

  page.drawText("Banking details for EFT / deposit", {
    x: 62,
    y: y - 6,
    size: 9,
    font: fontBold,
    color: primary,
  });
  y -= 20;

  for (const line of lines) {
    page.drawText(line.slice(0, 78), {
      x: 62,
      y,
      size: 9,
      font,
      color: rgb(0.15, 0.15, 0.2),
    });
    y -= 12;
  }

  if (reference) {
    const label = params.accountNumberLabel ?? "Payment reference (learner account no.)";
    page.drawText(`${label}: ${reference}`.slice(0, 78), {
      x: 62,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.2),
    });
    y -= 12;
    page.drawText("Use this account number as the bank payment reference.", {
      x: 62,
      y,
      size: 8,
      font,
      color: MUTED,
    });
    y -= 12;
  }

  return y - 10;
}

/** Compact contact/address footer for official documents. */
export function drawBrandedFooter(params: {
  page: PDFPage;
  brand: SchoolBrand;
  font: PDFFont;
  y?: number;
  color?: RGB;
}): number {
  const { page, brand, font } = params;
  const { width } = page.getSize();
  let y = params.y ?? 48;
  const color = params.color ?? MUTED;
  const address = formatSchoolAddress(brand);
  const contact = formatSchoolContactLine(brand);
  const reg = brand.registrationNo
    ? `Reg. No: ${brand.registrationNo}`
    : null;

  const lines = [address, contact, reg].filter(Boolean) as string[];
  for (const line of lines.reverse()) {
    const text = line.slice(0, 100);
    const tw = font.widthOfTextAtSize(text, 8);
    page.drawText(text, {
      x: (width - tw) / 2,
      y,
      size: 8,
      font,
      color,
    });
    y += 11;
  }

  return y;
}

/** Centered logo + school name for certificates / cards. */
export async function drawCenteredBrandMark(params: {
  doc: PDFDocument;
  page: PDFPage;
  brand: SchoolBrand;
  fontBold: PDFFont;
  y: number;
  nameSize?: number;
  nameColor?: RGB;
}): Promise<number> {
  const { doc, page, brand, fontBold } = params;
  const { width } = page.getSize();
  let y = params.y;
  const nameColor = params.nameColor ?? brandPrimaryRgb(brand);
  const nameSize = params.nameSize ?? 20;

  const logo = await embedSchoolLogo(doc, brand.logoUrl);
  if (logo) {
    const size = fitLogo(logo, 56, 90);
    page.drawImage(logo, {
      x: (width - size.width) / 2,
      y: y - size.height,
      width: size.width,
      height: size.height,
    });
    y -= size.height + 12;
  }

  const tw = fontBold.widthOfTextAtSize(brand.name, nameSize);
  page.drawText(brand.name, {
    x: (width - tw) / 2,
    y,
    size: nameSize,
    font: fontBold,
    color: nameColor,
  });
  return y - nameSize - 8;
}
