import { prisma } from "./db";

export type PublicCalendarItem = {
  date: Date;
  title: string;
  detail?: string | null;
  kind: "term" | "event" | "news";
};

export async function getPublicCalendarItems(schoolId: string): Promise<PublicCalendarItem[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 180);

  const [terms, events, news] = await Promise.all([
    prisma.term.findMany({
      where: { academicYear: { schoolId, isCurrent: true } },
      orderBy: { startDate: "asc" },
    }),
    prisma.schoolEvent.findMany({
      where: {
        schoolId,
        isPublic: true,
        startsAt: { lte: horizon },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.announcement.findMany({
      where: {
        schoolId,
        isPublic: true,
        publishAt: { gte: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 14), lte: horizon },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: { publishAt: "asc" },
      take: 30,
    }),
  ]);

  return [
    ...terms.flatMap((term) => [
      { date: term.startDate, title: `${term.name} starts`, detail: null, kind: "term" as const },
      { date: term.endDate, title: `${term.name} ends`, detail: null, kind: "term" as const },
    ]),
    ...events.map((event) => ({
      date: event.startsAt,
      title: event.title,
      detail: event.description,
      kind: "event" as const,
    })),
    ...news.map((item) => ({
      date: item.publishAt,
      title: item.title,
      detail: item.content,
      kind: "news" as const,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function getPublicNews(schoolId: string) {
  const now = new Date();
  return prisma.announcement.findMany({
    where: {
      schoolId,
      isPublic: true,
      publishAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
    orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }],
    take: 40,
  });
}
