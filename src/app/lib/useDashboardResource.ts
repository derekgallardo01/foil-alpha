"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Options<T> {
  /** Re-fetch whenever any of these change (same semantics as a useEffect dep array). */
  deps?: unknown[];
  /** Optional slow safety-net poll interval, in ms. */
  refreshMs?: number;
  /** Called with the payload after each successful load (e.g. to reset a carousel index). */
  onData?: (data: T[]) => void;
  /**
   * When `loading` is set. "always" (default) flips it on every fetch, so a
   * filter change shows a skeleton. "initial" flips it only for the first load,
   * so background refreshes (poll / SSE) update the data in place without a
   * skeleton flash.
   */
  loadingMode?: "always" | "initial";
}

interface Resource<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Shared data-loading for the dashboard widgets. Fetches the standard
 * `{ success, data }` envelope, tracks loading/error, and re-fetches when
 * `deps` change (plus an optional poll).
 *
 * Real-time (SSE) intentionally stays in the component: call `useEventStream`
 * with the returned `refetch` where a widget needs live pushes, so the widgets
 * that don't stream never open an EventSource connection.
 */
export function useDashboardResource<T = unknown>(
  url: string,
  opts: Options<T> = {}
): Resource<T> {
  const { deps = [], refreshMs, onData, loadingMode = "always" } = opts;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Held in refs so `refetch` keeps a stable identity (safe for intervals and
  // stream handlers) while always using the latest url / callback.
  const urlRef = useRef(url);
  urlRef.current = url;
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    // In "initial" mode only the first load shows a skeleton; later background
    // refreshes (poll/SSE) swap the data in without flipping `loading`.
    if (loadingMode === "always" || !hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      const res = await fetch(urlRef.current);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Failed to load data");
        setData([]);
        return;
      }
      const payload: T[] = json.data ?? [];
      setData(payload);
      onDataRef.current?.(payload);
    } catch {
      setError("Network error");
      setData([]);
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [loadingMode]);

  // Fetch on mount and whenever the caller's deps change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    refetch();
  }, deps);

  // Optional slow poll; primary freshness comes from deps changes / SSE.
  useEffect(() => {
    if (!refreshMs) return;
    const id = setInterval(refetch, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs, refetch]);

  return { data, loading, error, refetch };
}
