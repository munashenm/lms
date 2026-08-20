import { prisma } from "./db";
import { brandedEmailHtml } from "./email-branding";
import { emptySchoolPortalBrand, toSchoolPortalBrand } from "./school-branding";
import { APP_NAME } from "./constants";

export async function schoolEmailBrand(schoolId: string | null | undefined) {
  if (!schoolId) {
    return { ...emptySchoolPortalBrand(), schoolName: APP_NAME };
  }
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, logoUrl: true, primaryColor: true, accentColor: true },
  });
  const brand = toSchoolPortalBrand(school);
  return { ...brand, schoolName: brand.schoolName || APP_NAME };
}

export async function htmlForSchoolEmail(opts: {
  schoolId: string | null | undefined;
  title: string;
  bodyText: string;
}) {
  const brand = await schoolEmailBrand(opts.schoolId);
  return brandedEmailHtml({
    schoolName: brand.schoolName || APP_NAME,
    logoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
    accentColor: brand.accentColor,
    title: opts.title,
    bodyText: opts.bodyText,
  });
}
