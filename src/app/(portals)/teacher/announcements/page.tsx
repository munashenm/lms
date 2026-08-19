import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { AnnouncementList } from "@/components/announcements/announcement-list";
import { AnnouncementForm } from "@/components/announcements/announcement-form";

export default async function TeacherAnnouncementsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

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
        <p className="text-muted text-sm mt-1">Publish notices to students, parents, or staff</p>
      </div>
      <AnnouncementForm
        audiences={[
          { value: "STUDENTS", label: "Students" },
          { value: "PARENTS", label: "Parents" },
          { value: "TEACHERS", label: "Teachers" },
          { value: "STAFF", label: "Staff" },
        ]}
      />
      <AnnouncementList announcements={announcements} />
    </div>
  );
}
