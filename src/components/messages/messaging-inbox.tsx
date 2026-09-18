"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

interface MessageItem {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  attachmentUrl?: string | null;
  readAt?: string | null;
  sender?: { firstName: string; lastName: string };
  recipients?: Array<{ user: { firstName: string; lastName: string } }>;
}

export function MessagingInbox({
  directory,
  classes,
  grades,
  canSend,
  canBulk,
}: {
  directory: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
  grades: Array<{ id: string; name: string }>;
  canSend: boolean;
  canBulk: boolean;
}) {
  const [box, setBox] = useState<"inbox" | "sent" | "archive">("inbox");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);

  async function load(nextBox = box) {
    const res = await fetch(`/api/messages?box=${nextBox}`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages ?? []);
    setUnread(data.unread ?? 0);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load inbox on mount
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/messages", { method: "POST", body: new FormData(e.currentTarget) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Send failed");
      toast.success("Message sent");
      e.currentTarget.reset();
      setReplyTo(null);
      load("sent");
      setBox("sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setLoading(false);
    }
  }

  async function mark(id: string, action: "read" | "archive") {
    await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  const visible = messages.filter((m) => {
    const hay = `${m.subject} ${m.body}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {canSend ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{replyTo ? "Reply" : "Compose"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={send} className="space-y-3">
              {replyTo ? <input type="hidden" name="threadId" value={replyTo.id} /> : null}
              <div className="space-y-2">
                <Label>To</Label>
                <select
                  name="userIds"
                  multiple
                  className="min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  required={!canBulk}
                >
                  {directory.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted">Hold Ctrl/Cmd to select more than one person.</p>
              </div>
              {canBulk ? (
                <div className="space-y-2">
                  <Label>Or send to a group</Label>
                  <select name="audience" defaultValue="USERS" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
                    <option value="USERS">Selected people</option>
                    <option value="CLASS">Entire class (students + parents)</option>
                    <option value="GRADE">Entire grade</option>
                    <option value="STAFF">Staff</option>
                    <option value="DEPARTMENT">Department</option>
                  </select>
                  <select name="classId" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
                    <option value="">Select class</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <select name="gradeId" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
                    <option value="">Select grade</option>
                    {grades.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <Input name="department" placeholder="Department name (for department send)" />
                </div>
              ) : (
                <input type="hidden" name="audience" value="USERS" />
              )}
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input name="subject" required maxLength={200} defaultValue={replyTo ? `Re: ${replyTo.subject}` : ""} key={replyTo?.id ?? "new"} />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <textarea name="body" required rows={5} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Attachment</Label>
                <Input name="attachment" type="file" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  Send
                </Button>
                {replyTo ? (
                  <Button type="button" variant="outline" onClick={() => setReplyTo(null)}>
                    Cancel reply
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="lg:col-span-2">
          <CardContent className="py-10 text-sm text-muted">You can read messages assigned to you, but sending is not enabled for this account.</CardContent>
        </Card>
      )}

      <Card className="lg:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Messages {unread > 0 ? <Badge className="ml-2">{unread} unread</Badge> : null}
          </CardTitle>
          <div className="flex gap-2">
            {(["inbox", "sent", "archive"] as const).map((item) => (
              <Button
                key={item}
                size="sm"
                variant={box === item ? "default" : "outline"}
                onClick={() => {
                  setBox(item);
                  load(item);
                }}
              >
                {item[0].toUpperCase() + item.slice(1)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages" />
          {visible.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">No messages yet.</p>
          ) : (
            visible.map((message) => (
              <div key={message.id} className="w-full text-left rounded-lg border border-border p-3">
                <button className="w-full text-left" onClick={() => mark(message.id, "read")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{message.subject}</p>
                    {!message.readAt && box === "inbox" ? <Badge variant="warning">Unread</Badge> : null}
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {message.sender
                      ? `${message.sender.firstName} ${message.sender.lastName}`
                      : message.recipients?.map((r) => `${r.user.firstName} ${r.user.lastName}`).join(", ")}
                    {" · "}
                    {formatDateTime(message.createdAt)}
                  </p>
                  <p className="text-sm mt-2 line-clamp-3 whitespace-pre-wrap">{message.body}</p>
                </button>
                {message.attachmentUrl ? (
                  <a href={message.attachmentUrl} className="text-xs text-primary mt-2 inline-block">
                    Download attachment
                  </a>
                ) : null}
                {box === "inbox" ? (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={() => setReplyTo(message)}>
                      Reply
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => mark(message.id, "archive")}>
                      Archive
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
