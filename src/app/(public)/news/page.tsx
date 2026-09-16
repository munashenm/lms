import { getFeaturedSchool } from "@/lib/public-site";
import { getPublicNews } from "@/lib/public-calendar";
import { publicPageMetadata } from "@/lib/site-metadata";
import { EmptyNote, PageHero, SiteSection } from "@/components/public/site-ui";
import { formatDate } from "@/lib/utils";

export const metadata = publicPageMetadata("News", "School news and notices.");
export const dynamic = "force-dynamic";

export default async function PublicNewsPage() {
  const school = await getFeaturedSchool();
  const news = school ? await getPublicNews(school.id) : [];

  return (
    <>
      <PageHero
        eyebrow="News"
        title="Notices and campus news."
        description={`Published by ${school?.name ?? "the school"}.`}
        imageUrl={school?.heroImageUrl}
      />
      <SiteSection>
        {news.length === 0 ? (
          <EmptyNote>No public news yet.</EmptyNote>
        ) : (
          <div className="space-y-4 max-w-4xl">
            {news.map((item) => (
              <article key={item.id} className="bg-white border border-[var(--site-line)] rounded-[14px] p-6 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-dark)]">
                  {formatDate(item.publishAt)}
                </p>
                <h2 className="text-xl">{item.title}</h2>
                <p className="text-[var(--site-muted)] whitespace-pre-wrap">{item.content}</p>
              </article>
            ))}
          </div>
        )}
      </SiteSection>
    </>
  );
}
