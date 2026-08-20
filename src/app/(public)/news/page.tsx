import { getFeaturedSchool } from "@/lib/public-site";
import { getPublicNews } from "@/lib/public-calendar";
import { publicPageMetadata } from "@/lib/site-metadata";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const metadata = publicPageMetadata("News", "School news and notices.");
export const dynamic = "force-dynamic";

export default async function PublicNewsPage() {
  const school = await getFeaturedSchool();
  const news = school ? await getPublicNews(school.id) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">News</h1>
        <p className="text-muted mt-2">Notices published by {school?.name ?? "the school"}.</p>
      </div>
      {news.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-sm text-muted text-center">No public news yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {news.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-6 space-y-2">
                <p className="text-xs text-muted">{formatDate(item.publishAt)}</p>
                <h2 className="text-xl font-semibold">{item.title}</h2>
                <p className="text-sm text-muted whitespace-pre-wrap">{item.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
