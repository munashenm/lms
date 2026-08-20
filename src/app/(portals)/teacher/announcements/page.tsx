import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { AnnouncementList } from "@/components/announcements/announcement-list";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { getTerminology } from "@/lib/terminology";

export default async function TeacherAnnouncementsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const school = session!.schoolId
    ? await prisma.school.findUnique({
        where: { id: session!.schoolId },
        select: { institutionType: true },
      })
    : null;
  const terms = getTerminology(school?.institutionType);

  const announcements = await prisma.announcement.findMany({
    where: {
      ...filter,
      OR: [
        { audience: { in: ["ALL", "STAFF", "TEACHERS"] } },
        { authorId: session!.userId },
      ],
    },
    include: { author: { select: { firstName: true, lastName: true } } },
    orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-muted text-sm mt-1">Publish notices to {terms.students.toLowerCase()}, parents, or staff</p>
      </div>
      <AnnouncementForm
        audiences={[
          { value: "STUDENTS", label: terms.students },
          { value: "PARENTS", label: "Parents" },
          { value: "TEACHERS", label: terms.teachers },
          { value: "STAFF", label: "Staff" },
        ]}
      />
      <AnnouncementList announcements={announcements} canManagePublic />
    </div>
  );
}
