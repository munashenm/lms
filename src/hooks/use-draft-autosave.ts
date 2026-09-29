"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function readStoredDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readHasDraft(key: string, enabled: boolean): boolean {
  if (!enabled || typeof window === "undefined") return false;
  try {
    return Boolean(localStorage.getItem(key));
  } catch {
    return false;
  }
}

export function useDraftAutosave<T>(key: string, value: T, enabled = true) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [trackedKey, setTrackedKey] = useState(key);
  const [hasDraft, setHasDraft] = useState(() => readHasDraft(key, enabled));
  const restored = useRef(false);

  // React-recommended: adjust state when the draft key prop changes (not via effect).
  if (key !== trackedKey) {
    setTrackedKey(key);
    setHasDraft(readHasDraft(key, enabled));
  }

  useEffect(() => {
    restored.current = false;
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        setLastSaved(new Date());
        setHasDraft(true);
      } catch {
        /* ignore quota errors */
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [key, value, enabled]);

  const restoreDraft = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      restored.current = true;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, [key]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setHasDraft(false);
      setLastSaved(null);
    } catch {
      /* ignore */
    }
  }, [key]);

  return { lastSaved, hasDraft, restoreDraft, clearDraft };
}
