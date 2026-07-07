import { EventEmitter } from "events";

/**
 * In-process event bus for real-time push (SSE).
 *
 * The app runs as a single Node process (the in-app cron already relies on this),
 * so a plain EventEmitter is enough to fan out bid/auction/notification events to
 * connected `/api/events/stream` clients without adding a broker. Stashed on
 * globalThis so it survives dev HMR / module reloads.
 */
export interface AppEvent {
  type: "bid" | "outbid" | "auction_ended" | "auction_won" | "notification";
  /** The auction (userCard) id, when the event is about one. */
  auctionId?: number;
  /** If set, only this user's stream receives the event; otherwise broadcast. */
  userId?: number;
}

const g = globalThis as unknown as { __appEvents?: EventEmitter };
const emitter: EventEmitter = g.__appEvents ?? (g.__appEvents = new EventEmitter());
emitter.setMaxListeners(0); // many concurrent SSE subscribers

const CHANNEL = "event";

/** Publish an event to all subscribers. Never throws — real-time is best-effort. */
export function emitAppEvent(event: AppEvent): void {
  try {
    emitter.emit(CHANNEL, event);
  } catch {
    /* best-effort */
  }
}

/** Subscribe to events; returns an unsubscribe function. */
export function onAppEvent(handler: (event: AppEvent) => void): () => void {
  emitter.on(CHANNEL, handler);
  return () => emitter.off(CHANNEL, handler);
}
