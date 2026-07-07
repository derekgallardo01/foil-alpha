import { describe, it, expect, vi } from "vitest";
import { emitAppEvent, onAppEvent } from "../events";

describe("app event bus", () => {
  it("delivers emitted events to subscribers in order", () => {
    const seen: unknown[] = [];
    const off = onAppEvent((e) => seen.push(e));
    emitAppEvent({ type: "bid", auctionId: 7 });
    emitAppEvent({ type: "notification", userId: 3 });
    off();
    expect(seen).toEqual([
      { type: "bid", auctionId: 7 },
      { type: "notification", userId: 3 },
    ]);
  });

  it("stops delivering after unsubscribe", () => {
    const fn = vi.fn();
    const off = onAppEvent(fn);
    off();
    emitAppEvent({ type: "bid", auctionId: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("fans out to multiple subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onAppEvent(a);
    const offB = onAppEvent(b);
    emitAppEvent({ type: "auction_ended", auctionId: 2 });
    offA();
    offB();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
