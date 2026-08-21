import { prisma } from "@/lib/db";
import { invoiceSchoolDetailLines } from "@/lib/fee-collection";
import { schoolBankingLines, toSchoolBrand } from "@/lib/pdf-branding";

export async function loadFeeCollectionPage(schoolId: string | undefined) {
  if (!schoolId) {
    return {
      schoolName: "School",
      schoolLines: [] as string[],
      classes: [] as Array<{ id: string; name: string; gradeName: string | null }>,
    };
  }

  const [school, classes] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.class.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true, grade: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const brand = school ? toSchoolBrand(school) : null;

  return {
    schoolName: school?.name ?? "School",
    schoolLines: brand
      ? [...invoiceSchoolDetailLines(brand), ...schoolBankingLines(brand)]
      : [],
    classes: classes.map((row) => ({
      id: row.id,
      name: row.name,
      gradeName: row.grade?.name ?? null,
    })),
  };
}
