import { getFeaturedSchool } from "@/lib/public-site";
import { getPublicCalendarItems } from "@/lib/public-calendar";
import { publicPageMetadata } from "@/lib/site-metadata";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const metadata = publicPageMetadata("Calendar", "Term dates and school events.");
export const dynamic = "force-dynamic";

export default async function PublicCalendarPage() {
  const school = await getFeaturedSchool();
  const items = school ? await getPublicCalendarItems(school.id) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Calendar</h1>
        <p className="text-muted mt-2">Term dates, events and public notices.</p>
      </div>
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-sm text-muted text-center">No upcoming public dates.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {items.map((item, index) => (
              <div key={`${item.kind}-${item.title}-${index}`} className="px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-muted">{item.kind}</p>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted">{formatDate(item.date)}</p>
                {item.detail ? <p className="text-sm mt-1 whitespace-pre-wrap">{item.detail}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
