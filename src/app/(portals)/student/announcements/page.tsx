import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { AnnouncementList } from "@/components/announcements/announcement-list";

export default async function StudentAnnouncementsPage() {
  const session = await getSession();

  const announcements = await prisma.announcement.findMany({
    where: {
      ...(session!.schoolId ? { schoolId: session!.schoolId } : {}),
      audience: { in: ["ALL", "STUDENTS"] },
    },
    include: { author: { select: { firstName: true, lastName: true } } },
    orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-muted text-sm mt-1">Notices from your school</p>
      </div>
      <AnnouncementList announcements={announcements} />
    </div>
  );
}
