import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: string;
  isPinned: boolean;
  publishAt: Date;
  author?: { firstName: string; lastName: string } | null;
}

export function AnnouncementList({ announcements }: { announcements: Announcement[] }) {
  if (announcements.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted text-sm">
          No announcements yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((ann) => (
        <Card key={ann.id}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{ann.title}</h3>
                  {ann.isPinned && <Badge variant="accent">Pinned</Badge>}
                </div>
                <p className="text-sm text-muted mt-2 whitespace-pre-wrap">{ann.content}</p>
                <p className="text-xs text-muted mt-3">
                  {formatDate(ann.publishAt)}
                  {ann.author && ` · ${ann.author.firstName} ${ann.author.lastName}`}
                  {` · ${ann.audience}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
