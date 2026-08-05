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
};

const BRAND_BLUE = rgb(0.11, 0.3, 0.43);
const WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.45, 0.45, 0.5);

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
  };
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
    if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
      const res = await fetch(logoUrl);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }

    const relative = logoUrl.startsWith("/") ? logoUrl.slice(1) : logoUrl;
    const filePath = path.join(process.cwd(), "public", relative);
    const buf = await readFile(filePath);
    return new Uint8Array(buf);
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

/** Dark banner header with optional logo, school name, document title, and contact line. */
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
  const headerHeight = params.headerHeight ?? 88;
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width,
    height: headerHeight,
    color: BRAND_BLUE,
  });

  const logo = await embedSchoolLogo(doc, brand.logoUrl);
  let textX = 50;
  if (logo) {
    const size = fitLogo(logo, 48, 72);
    page.drawImage(logo, {
      x: 40,
      y: height - headerHeight + (headerHeight - size.height) / 2,
      width: size.width,
      height: size.height,
    });
    textX = 40 + size.width + 16;
  }

  page.drawText(brand.name, {
    x: textX,
    y: height - 36,
    size: 16,
    font: fontBold,
    color: WHITE,
  });
  page.drawText(title.toUpperCase(), {
    x: textX,
    y: height - 54,
    size: 11,
    font,
    color: rgb(0.9, 0.9, 0.9),
  });

  const contact = formatSchoolContactLine(brand);
  if (contact) {
    page.drawText(contact.slice(0, 90), {
      x: textX,
      y: height - 72,
      size: 8,
      font,
      color: rgb(0.85, 0.88, 0.9),
    });
  }

  return height - headerHeight - 24;
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
  const nameColor = params.nameColor ?? BRAND_BLUE;
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
