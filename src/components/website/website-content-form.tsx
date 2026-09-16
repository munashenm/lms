"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface WebsiteSchool {
  id: string;
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  heroHeadline: string | null;
  heroSubtitle: string | null;
  aboutText: string | null;
  missionText: string | null;
  visionText: string | null;
  valuesText: string | null;
  principalName: string | null;
  principalTitle: string | null;
  principalMessage: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  officeHours: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  youtubeUrl: string | null;
  whyChooseUs: unknown;
  publishPublicStats: boolean;
}

interface Faq {
  id: string;
  question: string;
  answer: string;
}

interface GalleryItem {
  id: string;
  imageUrl: string;
  caption: string | null;
}

function whyToText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const row = item as { title?: string; description?: string };
      return `${row.title ?? ""}\n${row.description ?? ""}`.trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

function textToWhy(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((block) => {
      const [title, ...rest] = block.split("\n");
      return { title: (title ?? "").trim(), description: rest.join(" ").trim() };
    })
    .filter((item) => item.title && item.description);
}

export function WebsiteContentForm({
  school,
  faqs,
  gallery,
  manageSchoolId,
}: {
  school: WebsiteSchool;
  faqs: Faq[];
  gallery: GalleryItem[];
  manageSchoolId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(school.logoUrl);
  const [faviconUrl, setFaviconUrl] = useState(school.faviconUrl);
  const [heroImageUrl, setHeroImageUrl] = useState(school.heroImageUrl);

  async function upload(kind: "logo" | "favicon" | "hero" | "gallery", file: File, caption?: string) {
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    if (manageSchoolId) form.set("schoolId", manageSchoolId);
    if (caption) form.set("caption", caption);
    const res = await fetch("/api/school/branding", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Upload failed");
    return data as { url?: string };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(
        manageSchoolId ? `/api/school?schoolId=${encodeURIComponent(manageSchoolId)}` : "/api/school",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(manageSchoolId ? { schoolId: manageSchoolId } : {}),
            logoUrl: logoUrl || "",
            faviconUrl: faviconUrl || "",
            heroImageUrl: heroImageUrl || "",
            heroHeadline: form.get("heroHeadline"),
            heroSubtitle: form.get("heroSubtitle"),
            aboutText: form.get("aboutText"),
            missionText: form.get("missionText"),
            visionText: form.get("visionText"),
            valuesText: form.get("valuesText"),
            principalName: form.get("principalName"),
            principalTitle: form.get("principalTitle"),
            principalMessage: form.get("principalMessage"),
            email: form.get("email") || "",
            phone: form.get("phone") || undefined,
            whatsapp: form.get("whatsapp"),
            address: form.get("address"),
            officeHours: form.get("officeHours"),
            facebookUrl: form.get("facebookUrl") || "",
            instagramUrl: form.get("instagramUrl") || "",
            twitterUrl: form.get("twitterUrl") || "",
            linkedinUrl: form.get("linkedinUrl") || "",
            youtubeUrl: form.get("youtubeUrl") || "",
            whyChooseUs: textToWhy(String(form.get("whyChooseUs") ?? "")),
            publishPublicStats: form.get("publishPublicStats") === "on",
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Could not save website");
      }
      toast.success("Website saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save website");
    } finally {
      setLoading(false);
    }
  }

  async function addFaq(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      question: String(new FormData(form).get("question") ?? ""),
      answer: String(new FormData(form).get("answer") ?? ""),
    };
    const res = await fetch("/api/website/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Could not add FAQ");
      return;
    }
    form.reset();
    toast.success("FAQ added");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branding</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Logo</Label>
              {logoUrl ? <img src={logoUrl} alt="" className="h-16 object-contain" /> : null}
              <Input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const data = await upload("logo", file);
                  setLogoUrl(data.url ?? logoUrl);
                  toast.success("Logo uploaded");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Upload failed");
                }
              }} />
            </div>
            <div className="space-y-2">
              <Label>Favicon</Label>
              {faviconUrl ? <img src={faviconUrl} alt="" className="h-10 object-contain" /> : null}
              <Input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const data = await upload("favicon", file);
                  setFaviconUrl(data.url ?? faviconUrl);
                  toast.success("Favicon uploaded");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Upload failed");
                }
              }} />
            </div>
            <div className="space-y-2">
              <Label>Hero image</Label>
              {heroImageUrl ? <img src={heroImageUrl} alt="" className="h-16 w-full object-cover rounded" /> : null}
              <Input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const data = await upload("hero", file);
                  setHeroImageUrl(data.url ?? heroImageUrl);
                  toast.success("Hero image uploaded");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Upload failed");
                }
              }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hero & about</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Hero heading</Label>
              <Input name="heroHeadline" defaultValue={school.heroHeadline ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Hero description</Label>
              <textarea name="heroSubtitle" rows={3} className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" defaultValue={school.heroSubtitle ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>About</Label>
              <textarea name="aboutText" rows={5} className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" defaultValue={school.aboutText ?? ""} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mission</Label>
                <textarea name="missionText" rows={4} className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" defaultValue={school.missionText ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Vision</Label>
                <textarea name="visionText" rows={4} className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" defaultValue={school.visionText ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Values (one per line)</Label>
              <textarea name="valuesText" rows={4} className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" defaultValue={school.valuesText ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Why choose us (title then description, blank line between items)</Label>
              <textarea name="whyChooseUs" rows={6} className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" defaultValue={whyToText(school.whyChooseUs)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Principal / director name</Label>
                <Input name="principalName" defaultValue={school.principalName ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input name="principalTitle" defaultValue={school.principalTitle ?? ""} placeholder="Principal" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Principal / director message</Label>
              <textarea name="principalMessage" rows={4} className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" defaultValue={school.principalMessage ?? ""} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="publishPublicStats" defaultChecked={school.publishPublicStats} className="h-4 w-4" />
              Publish real learner/staff counts on the public website
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact & social</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" defaultValue={school.email ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input name="phone" defaultValue={school.phone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input name="whatsapp" defaultValue={school.whatsapp ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Office hours</Label>
              <Input name="officeHours" defaultValue={school.officeHours ?? ""} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Input name="address" defaultValue={school.address ?? ""} />
            </div>
            <Input name="facebookUrl" placeholder="Facebook URL" defaultValue={school.facebookUrl ?? ""} />
            <Input name="instagramUrl" placeholder="Instagram URL" defaultValue={school.instagramUrl ?? ""} />
            <Input name="twitterUrl" placeholder="X / Twitter URL" defaultValue={school.twitterUrl ?? ""} />
            <Input name="linkedinUrl" placeholder="LinkedIn URL" defaultValue={school.linkedinUrl ?? ""} />
            <Input name="youtubeUrl" placeholder="YouTube URL" defaultValue={school.youtubeUrl ?? ""} />
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save website"}
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gallery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept="image/*" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              await upload("gallery", file);
              toast.success("Image added");
              router.refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Upload failed");
            }
          }} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {gallery.map((item) => (
              <div key={item.id} className="space-y-2">
                <img src={item.imageUrl} alt="" className="h-24 w-full object-cover rounded" />
                <Button size="sm" variant="outline" onClick={async () => {
                  await fetch(`/api/website/gallery/${item.id}`, { method: "DELETE" });
                  router.refresh();
                }}>Remove</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">FAQs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(e) => void addFaq(e)} className="grid gap-3 sm:grid-cols-2">
            <Input name="question" placeholder="Question" required />
            <Input name="answer" placeholder="Answer" required />
            <Button type="submit" size="sm">Add FAQ</Button>
          </form>
          <ul className="space-y-2 text-sm">
            {faqs.map((faq) => (
              <li key={faq.id} className="flex justify-between gap-3 border border-border rounded-lg p-3">
                <div>
                  <p className="font-medium">{faq.question}</p>
                  <p className="text-muted">{faq.answer}</p>
                </div>
                <Button size="sm" variant="outline" onClick={async () => {
                  await fetch(`/api/website/faqs/${faq.id}`, { method: "DELETE" });
                  router.refresh();
                }}>Remove</Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
