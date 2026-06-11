"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ContactFormProps {
  schoolEmail?: string;
}

export function ContactForm({ schoolEmail }: ContactFormProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Could not send message");
        return;
      }
      setSent(true);
      toast.success("Message sent!");
    } catch {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="font-semibold">Thank you for your message</p>
          <p className="text-sm text-muted mt-2">
            We will respond{schoolEmail ? ` to your email` : ""} within 1–2 working days.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send a message</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input name="name" required />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input name="email" type="email" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input name="subject" required placeholder="Admissions enquiry" />
          </div>
          <div className="space-y-2">
            <Label>Message *</Label>
            <textarea
              name="message"
              rows={5}
              required
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              placeholder="How can we help?"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
