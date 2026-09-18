"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

export function MessageUnread({ href }: { href: string }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/messages/unread");
        if (!res.ok) return;
        const data = await res.json();
        setUnread(Number(data.unread ?? 0));
      } catch {
        /* ignore */
      }
    }
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Link href={href} className="relative rounded-lg p-2 text-muted hover:bg-background" aria-label="Messages">
      <MessageSquare className="h-5 w-5" />
      {unread > 0 ? (
        <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-danger text-[10px] font-bold text-white flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
