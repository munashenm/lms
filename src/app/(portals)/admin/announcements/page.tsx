import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { AnnouncementList } from "@/components/announcements/announcement-list";
import { AnnouncementForm } from "@/components/announcements/announcement-form";

export default async function AnnouncementsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const announcements = await prisma.announcement.findMany({
    where: filter,
    include: { author: { select: { firstName: true, lastName: true } } },
    orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-muted text-sm mt-1">Broadcast notices to your school community</p>
      </div>

      <AnnouncementForm />
      <AnnouncementList announcements={announcements} />
    </div>
  );
}
