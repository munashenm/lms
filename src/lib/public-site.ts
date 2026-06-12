import { prisma } from "./db";

export {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_DESCRIPTIONS,
} from "./application-status";

export async function getFeaturedSchool() {
  try {
    return await prisma.school.findFirst({
      where: { isActive: true },
      include: {
        campuses: { where: { isMain: true }, take: 1 },
        courses: {
          include: { modules: { orderBy: { sortOrder: "asc" } } },
          orderBy: { name: "asc" },
        },
        grades: { orderBy: { sortOrder: "asc" } },
        _count: { select: { students: true, teachers: true, courses: true } },
      },
    });
  } catch {
    // Build phase (e.g. Railway Docker) has no DB — return null for static fallbacks
    return null;
  }
}
