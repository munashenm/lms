import { getFeaturedSchool } from "@/lib/public-site";
import { publicPageMetadata } from "@/lib/site-metadata";
import { EmptyNote, PageHero, SiteSection } from "@/components/public/site-ui";

export const metadata = publicPageMetadata("Gallery", "Campus and school gallery.");
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const school = await getFeaturedSchool();
  const items = school?.websiteGallery ?? [];

  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title={`Life at ${school?.name ?? "our institution"}.`}
        description="A look at campus, classrooms and the community."
        imageUrl={school?.heroImageUrl || items[0]?.imageUrl}
      />
      <SiteSection>
        {items.length === 0 ? (
          <EmptyNote>Gallery images will appear here once published.</EmptyNote>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {items.map((item, index) => (
              <figure
                key={item.id}
                className={`overflow-hidden rounded-[14px] ${index === 0 ? "sm:col-span-2 sm:row-span-2" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.altText || item.caption || school?.name || "Gallery image"}
                  className={index === 0 ? "h-full min-h-[280px] w-full object-cover" : "h-56 w-full object-cover"}
                />
                {item.caption ? (
                  <figcaption className="px-3 py-2 text-sm text-[var(--site-muted)] bg-white">{item.caption}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        )}
      </SiteSection>
    </>
  );
}
