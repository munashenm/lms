"use client";

import { useState } from "react";
import { toast } from "sonner";
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
      <div className="bg-white border border-[var(--site-line)] rounded-[14px] py-12 px-8 text-center">
        <p className="font-[family-name:var(--site-serif)] text-2xl text-primary">Thank you for your message</p>
        <p className="text-sm text-[var(--site-muted)] mt-2">
          We will respond{schoolEmail ? ` to your email` : ""} within 1–2 working days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[var(--site-line)] rounded-[14px] p-8 space-y-1">
      <h2 className="section-title mb-4">Send a message</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block font-semibold text-[0.88rem] text-primary">
          Name *
          <input name="name" required className="mt-1.5 w-full rounded-[10px] border border-[var(--site-line)] bg-white px-3.5 py-3 text-[0.95rem] text-[var(--site-ink)] focus:outline-none focus:border-[var(--accent)]" />
        </label>
        <label className="block font-semibold text-[0.88rem] text-primary">
          Email *
          <input name="email" type="email" required className="mt-1.5 w-full rounded-[10px] border border-[var(--site-line)] bg-white px-3.5 py-3 text-[0.95rem] text-[var(--site-ink)] focus:outline-none focus:border-[var(--accent)]" />
        </label>
      </div>
      <label className="block font-semibold text-[0.88rem] text-primary pt-3">
        Subject *
        <input name="subject" required placeholder="Admissions enquiry" className="mt-1.5 w-full rounded-[10px] border border-[var(--site-line)] bg-white px-3.5 py-3 text-[0.95rem] text-[var(--site-ink)] focus:outline-none focus:border-[var(--accent)]" />
      </label>
      <label className="block font-semibold text-[0.88rem] text-primary pt-3">
        Message *
        <textarea
          name="message"
          rows={5}
          required
          placeholder="How can we help?"
          className="mt-1.5 w-full min-h-[120px] rounded-[10px] border border-[var(--site-line)] bg-white px-3.5 py-3 text-[0.95rem] text-[var(--site-ink)] focus:outline-none focus:border-[var(--accent)] resize-y"
        />
      </label>
      <button type="submit" className="site-btn site-btn-gold site-btn-arrow mt-5 w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Message"}
      </button>
    </form>
  );
}
