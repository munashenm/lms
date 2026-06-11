import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AnnouncementList } from "@/components/announcements/announcement-list";

export default async function ParentAnnouncementsPage() {
  const session = await getSession();

  const announcements = await prisma.announcement.findMany({
    where: {
      ...(session!.schoolId ? { schoolId: session!.schoolId } : {}),
      audience: { in: ["ALL", "PARENTS"] },
    },
    include: { author: { select: { firstName: true, lastName: true } } },
    orderBy: { publishAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-muted text-sm mt-1">School news and updates for parents</p>
      </div>
      <AnnouncementList announcements={announcements} />
    </div>
  );
}
