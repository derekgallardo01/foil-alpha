"use client";

import { useEffect, useRef } from "react";

export interface StreamEvent {
  type: "connected" | "bid" | "outbid" | "auction_ended" | "auction_won" | "notification";
  auctionId?: number;
  userId?: number;
}

/**
 * Subscribe to the server's real-time event stream (`/api/events/stream`).
 * `EventSource` reconnects automatically, so callers keep a slow fallback poll
 * for resilience. The handler is held in a ref so re-renders don't reopen the
 * connection.
 */
export function useEventStream(onEvent: (event: StreamEvent) => void): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/events/stream");
      es.onmessage = (ev) => {
        try {
          handler.current(JSON.parse(ev.data) as StreamEvent);
        } catch {
          /* ignore malformed frames (e.g. keep-alive) */
        }
      };
      // EventSource auto-reconnects on error; nothing to do here.
      es.onerror = () => {};
    } catch {
      /* stream unavailable — callers fall back to polling */
    }

    return () => es?.close();
  }, []);
}
