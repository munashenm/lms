"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useDraftAutosave<T>(key: string, value: T, enabled = true) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    if (!enabled || restored.current) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setHasDraft(true);
    } catch {
      /* ignore */
    }
  }, [key, enabled]);

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
