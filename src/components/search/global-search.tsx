"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type SearchResult = {
  kind: "learner" | "invoice" | "application" | "staff";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const KIND_LABEL: Record<SearchResult["kind"], string> = {
  learner: "Learner",
  invoice: "Invoice",
  application: "Application",
  staff: "Staff",
};

export function GlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    const handle = window.setTimeout(() => {
      if (q.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      void (async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          const data = await res.json().catch(() => ({ results: [] }));
          if (!res.ok) throw new Error(data.message || "Search failed");
          setResults(data.results ?? []);
          setActive(0);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      })();
    }, q.length < 2 ? 0 : 220);
    return () => window.clearTimeout(handle);
  }, [query]);

  function go(result: SearchResult) {
    close();
    router.push(result.href);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-muted hover:text-foreground"
        title="Search (Ctrl+K)"
        aria-label="Open search"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline text-xs">Search</span>
        <kbd className="hidden lg:inline text-[10px] rounded border border-border px-1 py-0.5">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-border bg-surface shadow-lg z-50">
          <div className="flex items-center gap-2 border-b border-border px-2 py-2">
            <Search className="h-4 w-4 text-muted shrink-0 ml-1" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Learner, invoice, application, staff…"
              className="border-0 shadow-none focus-visible:ring-0 h-9"
              aria-controls={listId}
              aria-autocomplete="list"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && results[active]) {
                  e.preventDefault();
                  go(results[active]);
                }
              }}
            />
            <button
              type="button"
              className="p-1 text-muted hover:text-foreground"
              onClick={close}
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {query.trim().length < 2 ? (
              <p className="px-3 py-4 text-xs text-muted">Type at least 2 characters</p>
            ) : loading ? (
              <p className="px-3 py-4 text-xs text-muted">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted">No matches</p>
            ) : (
              results.map((result, index) => (
                <button
                  key={`${result.kind}-${result.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    index === active ? "bg-primary/10" : "hover:bg-background"
                  }`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(result)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{result.title}</p>
                    <span className="text-[10px] uppercase tracking-wide text-muted shrink-0">
                      {KIND_LABEL[result.kind]}
                    </span>
                  </div>
                  <p className="text-xs text-muted truncate">{result.subtitle}</p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
