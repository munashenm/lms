import { getFeaturedSchool } from "@/lib/public-site";
import { publicPageMetadata } from "@/lib/site-metadata";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = publicPageMetadata("Gallery", "Campus and school gallery.");
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const school = await getFeaturedSchool();
  const items = school?.websiteGallery ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Gallery</h1>
        <p className="text-muted mt-2">Life at {school?.name ?? "our institution"}.</p>
      </div>
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-sm text-muted text-center">
            Gallery images will appear here once published.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <figure key={item.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.altText || item.caption || school?.name || "Gallery image"}
                className="h-56 w-full object-cover"
              />
              {item.caption ? (
                <figcaption className="px-3 py-2 text-sm text-muted">{item.caption}</figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
