import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { WebsiteContentForm } from "@/components/website/website-content-form";

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>;
}

export default async function WebsiteManagementPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const schoolId =
    session!.role === UserRole.SUPER_ADMIN && params.schoolId
      ? params.schoolId
      : "schoolId" in filter
        ? filter.schoolId
        : null;

  if (!schoolId) {
    const schools = await prisma.school.findMany({ where: { isActive: true } });
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Website Management</h1>
        {schools.map((school) => (
          <Link key={school.id} href={`/admin/website?schoolId=${school.id}`} className="block text-primary hover:underline">
            {school.name}
          </Link>
        ))}
      </div>
    );
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      websiteFaqs: { orderBy: { sortOrder: "asc" } },
      websiteGallery: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!school) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Website Management</h1>
        <p className="text-muted text-sm mt-1">
          Public website content for {school.name}.{" "}
          <Link href="/admin/website/admissions" className="text-primary hover:underline">
            Admissions settings
          </Link>
        </p>
      </div>
      <WebsiteContentForm
        school={school}
        faqs={school.websiteFaqs}
        gallery={school.websiteGallery}
        manageSchoolId={session!.role === UserRole.SUPER_ADMIN && !session!.schoolId ? school.id : undefined}
      />
    </div>
  );
}
