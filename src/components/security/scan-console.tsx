"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EARLY_DEPARTURE_REASON_LABELS, EARLY_DEPARTURE_REASONS } from "@/lib/gate/engine";

type Direction = "IN" | "OUT";
type Method = "QR" | "BARCODE" | "CAMERA" | "MANUAL";

type Person = {
  personType: "STUDENT" | "STAFF";
  personId?: string;
  displayName: string;
  number: string | null;
  detailLine: string | null;
  photoUrl: string | null;
  time?: string;
  punctualityLabel: string | null;
  timeOnSite: string | null;
  manualNote: string | null;
  accessAllowed?: boolean;
};

type ScanResult = {
  ok: boolean;
  code: string;
  title: string;
  detail: string;
  person: Person | null;
};

type GateOption = { id: string; name: string; code: string };

type DetectorCtor = new (opts: { formats: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

export function ScanConsole({ gates }: { gates: GateOption[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [direction, setDirection] = useState<Direction>("IN");
  const [gateId, setGateId] = useState(gates[0]?.id ?? "");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Person[]>([]);
  const [manualReason, setManualReason] = useState("");
  const [pending, setPending] = useState<{ token?: string; person?: Person; method: Method } | null>(null);
  const lastToken = useRef<string>("");

  useEffect(() => {
    inputRef.current?.focus();
  }, [result]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function submit(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/gate/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, gateId: gateId || undefined, ...payload }),
      });
      const json = (await res.json().catch(() => null)) as ScanResult | null;
      if (!json?.title) {
        setResult({ ok: false, code: "ACCESS_DENIED", title: "ACCESS DENIED", detail: "The scan could not be recorded.", person: null });
        return;
      }
      setResult(json);
      if (json.code === "EARLY_DEPARTURE") setPending({ token: payload.token as string | undefined, person: payload.personType ? { personType: payload.personType as "STUDENT", personId: String(payload.personId ?? ""), displayName: "", number: null, detailLine: null, photoUrl: null, punctualityLabel: null, timeOnSite: null, manualNote: null } : undefined, method: (payload.method as Method) ?? "QR" });
      else setPending(null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      inputRef.current?.focus();
    }
  }

  async function scanToken(token: string, method: Method) {
    const value = token.trim();
    if (!value) return;
    lastToken.current = value;
    setPending({ token: value, method });
    await submit({ method, token: value });
  }

  async function recordManual(person: Person) {
    if (!manualReason.trim() || !person.personId) return;
    setPending({ person, method: "MANUAL" });
    await submit({
      method: "MANUAL",
      personType: person.personType,
      personId: person.personId,
      manualReason: manualReason.trim(),
    });
  }

  async function confirmEarly(reason: string) {
    if (!pending) return;
    await submit({
      method: pending.method,
      token: pending.token,
      personType: pending.person?.personType,
      personId: pending.person?.personId,
      manualReason: pending.method === "MANUAL" ? manualReason : undefined,
      earlyDepartureReason: reason,
    });
  }

  async function searchPeople(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setMatches([]);
      return;
    }
    const res = await fetch(`/api/gate/lookup?q=${encodeURIComponent(value.trim())}`);
    const json = await res.json().catch(() => ({ people: [] }));
    setMatches(json.people ?? []);
  }

  function stopCamera() {
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (video) video.srcObject = null;
    setCameraOn(false);
  }

  async function startCamera() {
    const Detector = (window as Window & { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setCameraNote("This device has no camera scanner. Use a USB scanner or search for the person.");
      return;
    }
    setCameraNote(null);
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    await video.play();
    setCameraOn(true);
    const detector = new Detector({ formats: ["qr_code", "code_128", "code_39", "ean_13"] });
    const loop = async () => {
      if (!videoRef.current?.srcObject) return;
      try {
        const codes = await detector.detect(video);
        const raw = codes[0]?.rawValue;
        if (raw) {
          stopCamera();
          await scanToken(raw, "CAMERA");
          return;
        }
      } catch {
        setCameraNote("Camera scanning stopped. Use the USB scanner or search.");
        stopCamera();
        return;
      }
      window.setTimeout(loop, 250);
    };
    void loop();
  }

  const tone = !result ? "border-border" : result.ok ? "border-green-600 bg-green-50" : result.code === "EARLY_DEPARTURE" ? "border-amber-500 bg-amber-50" : "border-red-600 bg-red-50";

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["IN", "OUT"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setDirection(value)}
            className={`h-16 rounded-xl text-lg font-semibold ${direction === value ? "bg-primary text-white" : "border border-border bg-surface"}`}
          >
            {value === "IN" ? "Entry" : "Exit"}
          </button>
        ))}
      </div>

      {gates.length > 0 ? (
        <label className="block text-sm">
          <span className="text-muted">Checkpoint</span>
          <select value={gateId} onChange={(event) => setGateId(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3">
            {gates.map((gate) => (
              <option key={gate.id} value={gate.id}>{gate.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void scanToken(inputRef.current?.value ?? "", "QR");
        }}
        className="space-y-3"
      >
        <label className="block text-sm font-medium" htmlFor="gate-scan">
          Scan a card or type the code
        </label>
        <Input
          id="gate-scan"
          ref={inputRef}
          autoFocus
          autoComplete="off"
          placeholder="Ready for USB scanner"
          className="h-14 text-lg"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void scanToken(inputRef.current?.value ?? "", "BARCODE");
            }
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy} className="h-12 px-6">Scan card</Button>
          <Button type="button" variant="outline" className="h-12" onClick={() => (cameraOn ? stopCamera() : void startCamera())}>
            {cameraOn ? "Stop camera" : "Use camera"}
          </Button>
        </div>
        {cameraNote ? <p className="text-sm text-muted">{cameraNote}</p> : null}
        <video ref={videoRef} className={cameraOn ? "w-full max-w-md rounded-xl bg-black" : "hidden"} muted playsInline />
      </form>

      {result ? (
        <section className={`rounded-2xl border-2 p-6 ${tone}`}>
          <p className="text-3xl font-bold tracking-tight sm:text-4xl">{result.title}</p>
          <p className="mt-2 text-xl font-semibold">{result.detail}</p>
          {result.person ? (
            <div className="mt-4 flex gap-4">
              {result.person.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.person.photoUrl} alt="" className="h-24 w-20 rounded-lg object-cover" />
              ) : null}
              <div>
                <p className="text-2xl font-semibold">{result.person.displayName}</p>
                <p className="text-lg">{result.person.detailLine}</p>
                <p className="text-lg">{result.person.number}</p>
                {result.person.time ? <p className="mt-1 text-2xl font-bold">{result.person.time}</p> : null}
                {result.person.punctualityLabel ? <p className="font-medium">{result.person.punctualityLabel}</p> : null}
                {result.person.timeOnSite ? <p>Time on site: {result.person.timeOnSite}</p> : null}
                {result.person.manualNote ? <p className="mt-2 text-sm">{result.person.manualNote}</p> : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {result?.code === "EARLY_DEPARTURE" ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Why is this learner leaving?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {EARLY_DEPARTURE_REASONS.map((reason) => (
              <Button key={reason} type="button" variant="outline" className="h-12 justify-start" onClick={() => void confirmEarly(reason)}>
                {EARLY_DEPARTURE_REASON_LABELS[reason]}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h2 className="text-lg font-semibold">Can&apos;t scan? Search person</h2>
        <Input value={query} onChange={(event) => void searchPeople(event.target.value)} placeholder="Name, learner number, or staff number" className="h-12" />
        <Input value={manualReason} onChange={(event) => setManualReason(event.target.value)} placeholder="Reason for manual entry" />
        <div className="space-y-2">
          {matches.map((person) => (
            <div key={`${person.personType}-${person.personId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                {person.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={person.photoUrl} alt="" className="h-14 w-12 rounded object-cover" />
                ) : null}
                <div>
                  <p className="font-medium">{person.displayName}</p>
                  <p className="text-sm text-muted">{person.detailLine} {person.number}</p>
                  <p className="text-sm">{person.accessAllowed === false ? "Access not cleared" : "Cleared"}</p>
                </div>
              </div>
              <Button type="button" disabled={busy || !manualReason.trim()} onClick={() => void recordManual(person)}>
                Record {direction === "IN" ? "entry" : "exit"}
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
