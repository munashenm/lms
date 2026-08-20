"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: string;
  isPinned: boolean;
  isPublic?: boolean;
  publishAt: Date | string;
  author?: { firstName: string; lastName: string } | null;
}

export function AnnouncementList({
  announcements,
  canManagePublic = false,
}: {
  announcements: Announcement[];
  canManagePublic?: boolean;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function setPublic(id: string, isPublic: boolean) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Could not update announcement");
      }
      toast.success(isPublic ? "Shown on the public website" : "Hidden from the public website");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update announcement");
    } finally {
      setLoadingId(null);
    }
  }

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
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{ann.title}</h3>
                  {ann.isPinned && <Badge variant="accent">Pinned</Badge>}
                  {ann.isPublic ? <Badge variant="secondary">Website</Badge> : null}
                </div>
                <p className="text-sm text-muted mt-2 whitespace-pre-wrap">{ann.content}</p>
                <p className="text-xs text-muted mt-3">
                  {formatDate(ann.publishAt)}
                  {ann.author && ` · ${ann.author.firstName} ${ann.author.lastName}`}
                  {` · ${ann.audience}`}
                </p>
              </div>
              {canManagePublic ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingId === ann.id}
                  onClick={() => void setPublic(ann.id, !ann.isPublic)}
                >
                  {ann.isPublic ? "Hide from website" : "Show on website"}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
