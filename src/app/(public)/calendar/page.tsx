import { getFeaturedSchool } from "@/lib/public-site";
import { getPublicCalendarItems } from "@/lib/public-calendar";
import { publicPageMetadata } from "@/lib/site-metadata";
import { EmptyNote, PageHero, SiteSection } from "@/components/public/site-ui";
import { formatDate } from "@/lib/utils";

export const metadata = publicPageMetadata("Calendar", "Term dates and school events.");
export const dynamic = "force-dynamic";

export default async function PublicCalendarPage() {
  const school = await getFeaturedSchool();
  const items = school ? await getPublicCalendarItems(school.id) : [];

  return (
    <>
      <PageHero
        eyebrow="Calendar"
        title="Term dates and events."
        description="Public dates for families and applicants."
        imageUrl={school?.heroImageUrl}
      />
      <SiteSection>
        {items.length === 0 ? (
          <EmptyNote>No upcoming public dates.</EmptyNote>
        ) : (
          <div className="bg-white border border-[var(--site-line)] rounded-[14px] overflow-hidden">
            {items.map((item, index) => (
              <div
                key={`${item.kind}-${item.title}-${index}`}
                className="px-5 py-4 border-b border-[var(--site-line)] last:border-0 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 sm:gap-6"
              >
                <p className="text-sm font-semibold text-[var(--accent-dark)]">{formatDate(item.date)}</p>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--site-muted)] font-semibold">{item.kind}</p>
                  <p className="font-semibold text-primary">{item.title}</p>
                  {item.detail ? <p className="text-sm text-[var(--site-muted)] mt-1 whitespace-pre-wrap">{item.detail}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SiteSection>
    </>
  );
}
