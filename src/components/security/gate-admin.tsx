"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GateSettingsForm({
  initial,
}: {
  initial: {
    schoolStartTime: string;
    lateAfterMinutes: number;
    normalDepartureTime: string;
    duplicateScanIntervalSeconds: number;
    requireVisitorIdentity: boolean;
    allowVisitorPhoto: boolean;
  };
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setMessage(null);
    const res = await fetch("/api/gate/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolStartTime: formData.get("schoolStartTime"),
        lateAfterMinutes: Number(formData.get("lateAfterMinutes")),
        normalDepartureTime: formData.get("normalDepartureTime"),
        duplicateScanIntervalSeconds: Number(formData.get("duplicateScanIntervalSeconds")),
        requireVisitorIdentity: formData.get("requireVisitorIdentity") === "on",
        allowVisitorPhoto: formData.get("allowVisitorPhoto") === "on",
      }),
    });
    setPending(false);
    setMessage(res.ok ? "Gate settings saved." : "Could not save gate settings.");
    if (res.ok) router.refresh();
  }

  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">School start<input name="schoolStartTime" type="time" defaultValue={initial.schoolStartTime} className="mt-1 h-10 w-full rounded-lg border border-border px-3" required /></label>
      <label className="text-sm">Late after (minutes)<Input name="lateAfterMinutes" type="number" min={0} defaultValue={initial.lateAfterMinutes} /></label>
      <label className="text-sm">Normal departure<input name="normalDepartureTime" type="time" defaultValue={initial.normalDepartureTime} className="mt-1 h-10 w-full rounded-lg border border-border px-3" required /></label>
      <label className="text-sm">Duplicate scan interval (seconds)<Input name="duplicateScanIntervalSeconds" type="number" min={10} defaultValue={initial.duplicateScanIntervalSeconds} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requireVisitorIdentity" defaultChecked={initial.requireVisitorIdentity} /> Require visitor ID number</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowVisitorPhoto" defaultChecked={initial.allowVisitorPhoto} /> Allow visitor photos</label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>Save settings</Button>
        {message ? <p className="mt-2 text-sm">{message}</p> : null}
      </div>
    </form>
  );
}

export function CheckpointForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    const res = await fetch("/api/gate/checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        code: formData.get("code"),
        location: formData.get("location"),
        deviceId: formData.get("deviceId"),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Checkpoint added." : json.message ?? "Could not add checkpoint.");
    if (res.ok) router.refresh();
  }

  return (
    <form action={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <Input name="name" placeholder="Main gate" required />
      <Input name="code" placeholder="MAIN" required />
      <Input name="location" placeholder="Street entrance" />
      <Input name="deviceId" placeholder="Future device id" />
      <div className="sm:col-span-2">
        <Button type="submit">Add checkpoint</Button>
        {message ? <p className="mt-2 text-sm">{message}</p> : null}
      </div>
    </form>
  );
}

type CardPerson = {
  personType: "STUDENT" | "STAFF";
  personId: string;
  studentId: string | null;
  userId: string | null;
  displayName: string;
  number: string | null;
  detailLine: string | null;
  cardId: string | null;
  cardStatus: string;
};

export function CardAdmin() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<CardPerson[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setPeople([]);
      return;
    }
    const res = await fetch(`/api/gate/cards?q=${encodeURIComponent(value.trim())}`);
    const json = await res.json().catch(() => ({ people: [] }));
    setPeople(json.people ?? []);
  }

  async function issue(person: CardPerson) {
    const res = await fetch("/api/gate/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        holderType: person.personType,
        studentId: person.studentId,
        userId: person.userId,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(json.message ?? "Could not issue the card.");
      return;
    }
    setNotice(`Card issued. Print it now — the token is only encoded on the card.`);
    window.open(`/api/gate/cards/${json.cardId}/pdf`, "_blank");
    await search(query);
  }

  async function deactivate(person: CardPerson) {
    if (!person.cardId) return;
    const reason = window.prompt("Reason for deactivating this card", "Lost or stolen") ?? "";
    if (!reason.trim()) return;
    const res = await fetch(`/api/gate/cards/${person.cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deactivate", reason }),
    });
    setNotice(res.ok ? "Card deactivated. It will fail at the gate immediately." : "Could not deactivate the card.");
    if (res.ok) await search(query);
  }

  async function reissue(person: CardPerson) {
    if (!person.cardId) return;
    const res = await fetch(`/api/gate/cards/${person.cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reissue", reason: "Reissued by administrator" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(json.message ?? "Could not reissue the card.");
      return;
    }
    setNotice("Replacement card issued. The previous token no longer works.");
    window.open(`/api/gate/cards/${json.cardId}/pdf`, "_blank");
    await search(query);
  }

  return (
    <div className="space-y-4">
      <Input value={query} onChange={(event) => void search(event.target.value)} placeholder="Search learner or staff" className="h-12" />
      {notice ? <p className="text-sm">{notice}</p> : null}
      <div className="space-y-2">
        {people.map((person) => (
          <article key={`${person.personType}-${person.personId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
            <div>
              <p className="font-medium">{person.displayName}</p>
              <p className="text-sm text-muted">{person.detailLine} · {person.number} · {person.cardStatus === "ACTIVE" ? "Card active" : "No active card"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void issue(person)}>{person.cardId ? "Issue another" : "Issue card"}</Button>
              {person.cardId ? <Button type="button" variant="outline" onClick={() => void reissue(person)}>Reissue</Button> : null}
              {person.cardId ? <Button type="button" variant="destructive" onClick={() => void deactivate(person)}>Deactivate</Button> : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
