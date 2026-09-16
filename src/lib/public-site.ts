import { prisma } from "./db";
import { isCollegeLike } from "./terminology";
import { admissionYearLabel, isApplicationsOpen } from "./admissions";

export {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_DESCRIPTIONS,
} from "./application-status";
export { publicAcademicsHref, publicAcademicsLabel } from "./terminology";

export type WhyChooseItem = { title: string; description: string };

export function parseWhyChooseUs(value: unknown): WhyChooseItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { title?: unknown; description?: unknown };
      const title = typeof row.title === "string" ? row.title.trim() : "";
      const description = typeof row.description === "string" ? row.description.trim() : "";
      if (!title || !description) return null;
      return { title, description };
    })
    .filter((item): item is WhyChooseItem => Boolean(item));
}

export function defaultWhyChooseUs(college: boolean): WhyChooseItem[] {
  if (college) {
    return [
      {
        title: "Accredited programmes",
        description: "Industry-aligned programmes that prepare students for work and further study.",
      },
      {
        title: "Experienced lecturers",
        description: "Learn from lecturers who understand the South African skills landscape.",
      },
      {
        title: "Student support",
        description: "Admissions, academic and campus support from application through to qualification.",
      },
      {
        title: "POPIA-safe records",
        description: "Personal information is processed lawfully and kept for educational purposes only.",
      },
    ];
  }
  return [
    {
      title: "Quality teaching",
      description: "A structured academic programme with dedicated teachers and clear term planning.",
    },
    {
      title: "Safe, caring campus",
      description: "A professional school environment that supports learners and families.",
    },
    {
      title: "Clear admissions",
      description: "Apply online, track your application, and receive updates from the school.",
    },
    {
      title: "POPIA-compliant",
      description: "Learner and parent information is protected in line with South African law.",
    },
  ];
}

export async function getFeaturedSchool() {
  try {
    return await prisma.school.findFirst({
      where: { isActive: true },
      include: {
        campuses: { where: { isActive: true }, orderBy: [{ isMain: "desc" }, { name: "asc" }] },
        courses: {
          where: { isActive: true },
          include: { modules: { orderBy: { sortOrder: "asc" } } },
          orderBy: { name: "asc" },
        },
        grades: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        subjects: { where: { isActive: true }, orderBy: { name: "asc" } },
        admissionYear: true,
        websiteFaqs: { where: { isPublished: true }, orderBy: { sortOrder: "asc" } },
        websiteGallery: { where: { isPublished: true }, orderBy: { sortOrder: "asc" } },
        _count: { select: { students: true, teachers: true, courses: true } },
      },
    });
  } catch {
    return null;
  }
}

export type PublicSchool = NonNullable<Awaited<ReturnType<typeof getFeaturedSchool>>>;


export function schoolAddressLines(school: {
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  campuses?: Array<{
    isMain: boolean;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
  }>;
}): string[] {
  const campus = school.campuses?.find((item) => item.isMain) ?? school.campuses?.[0];
  const parts = [
    campus?.address || school.address,
    campus?.city || school.city,
    campus?.province || school.province,
    campus?.postalCode || school.postalCode,
  ].filter((value): value is string => Boolean(value && value.trim()));
  return parts;
}

export function formatSchoolAddress(school: Parameters<typeof schoolAddressLines>[0]): string {
  return schoolAddressLines(school).join(", ");
}

export function whatsappHref(number?: string | null): string | null {
  if (!number) return null;
  const digits = number.replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.startsWith("0") ? `27${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}`;
}

export function socialLinks(school: {
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  website?: string | null;
}): Array<{ label: string; href: string }> {
  const links: Array<{ label: string; href: string }> = [];
  if (school.facebookUrl) links.push({ label: "Facebook", href: school.facebookUrl });
  if (school.instagramUrl) links.push({ label: "Instagram", href: school.instagramUrl });
  if (school.twitterUrl) links.push({ label: "X", href: school.twitterUrl });
  if (school.linkedinUrl) links.push({ label: "LinkedIn", href: school.linkedinUrl });
  if (school.youtubeUrl) links.push({ label: "YouTube", href: school.youtubeUrl });
  return links;
}

export function publishedStats(school: PublicSchool): Array<{ label: string; value: number }> | null {
  if (!school.publishPublicStats) return null;
  const stats: Array<{ label: string; value: number }> = [];
  if (school._count.students > 0) stats.push({ label: isCollegeLike(school.institutionType) ? "Students" : "Learners", value: school._count.students });
  if (school._count.teachers > 0) stats.push({ label: isCollegeLike(school.institutionType) ? "Lecturers" : "Teachers", value: school._count.teachers });
  if (isCollegeLike(school.institutionType) && school._count.courses > 0) {
    stats.push({ label: "Programmes", value: school._count.courses });
  }
  return stats.length ? stats : null;
}

export function admissionSummary(school: PublicSchool) {
  const window = isApplicationsOpen(school);
  return {
    ...window,
    yearLabel: admissionYearLabel(school.admissionYear),
    yearName: school.admissionYear?.name ?? null,
    instructions: school.applicationInstructions || school.admissionsText,
    openFrom: school.applicationsOpenFrom,
    openUntil: school.applicationsOpenUntil,
  };
}
