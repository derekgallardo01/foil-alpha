import { describe, it, expect } from "vitest";
import { resolveProxyBid, BID_INCREMENT } from "./bid-resolution";

const inc = BID_INCREMENT;

describe("resolveProxyBid", () => {
  it("first bidder pays their entered amount (kept above reserve)", () => {
    const r = resolveProxyBid({ challengerAmount: 10, challengerMax: 25, reserve: 5, top: null });
    expect(r).toEqual({ challengerWins: true, challengerEffective: 10, topEffective: 0 });
  });

  it("first bidder floored at reserve when entered below it", () => {
    // (the endpoint rejects sub-reserve bids, but the math should still floor)
    const r = resolveProxyBid({ challengerAmount: 3, challengerMax: 3, reserve: 5, top: null });
    expect(r.challengerEffective).toBe(5);
  });

  it("higher max wins at just over the standing max", () => {
    const r = resolveProxyBid({
      challengerAmount: 12,
      challengerMax: 30,
      reserve: 5,
      top: { effective: 10, max: 20 },
    });
    expect(r.challengerWins).toBe(true);
    expect(r.challengerEffective).toBe(20 + inc); // 20.5, below their 30 max
    expect(r.topEffective).toBe(20); // standing bidder pushed to their max
  });

  it("winner never pays below their own entered amount", () => {
    // entered 25 but standing max only 15 -> pays their 25, not 15.5
    const r = resolveProxyBid({
      challengerAmount: 25,
      challengerMax: 40,
      reserve: 5,
      top: { effective: 12, max: 15 },
    });
    expect(r.challengerWins).toBe(true);
    expect(r.challengerEffective).toBe(25);
    expect(r.topEffective).toBe(15);
  });

  it("winner never pays above their own max", () => {
    // standing max 30, challenger max only 22 -> challenger LOSES (max <= top max)
    const r = resolveProxyBid({
      challengerAmount: 21,
      challengerMax: 22,
      reserve: 5,
      top: { effective: 20, max: 30 },
    });
    expect(r.challengerWins).toBe(false);
    expect(r.challengerEffective).toBe(22); // maxed out
    expect(r.topEffective).toBe(22 + inc); // standing bidder auto-raised just over
  });

  it("standing bidder's escalation is capped at their own max", () => {
    const r = resolveProxyBid({
      challengerAmount: 19,
      challengerMax: 19,
      reserve: 5,
      top: { effective: 10, max: 19.25 },
    });
    // challenger max 19 <= top max 19.25 -> top wins, escalates to min(19+inc, 19.25)
    expect(r.challengerWins).toBe(false);
    expect(r.topEffective).toBe(19.25);
  });

  it("plain bid vs plain bid behaves first-price (higher amount wins, pays their amount)", () => {
    // both non-proxy: max == amount
    const r = resolveProxyBid({
      challengerAmount: 15,
      challengerMax: 15,
      reserve: 5,
      top: { effective: 10, max: 10 },
    });
    expect(r.challengerWins).toBe(true);
    expect(r.challengerEffective).toBe(15); // clamp(10.5, low=15, high=15) = 15
    expect(r.topEffective).toBe(10);
  });

  it("tie on max: standing bidder retains the lead", () => {
    const r = resolveProxyBid({
      challengerAmount: 20,
      challengerMax: 20,
      reserve: 5,
      top: { effective: 12, max: 20 },
    });
    expect(r.challengerWins).toBe(false);
    expect(r.challengerEffective).toBe(20);
    expect(r.topEffective).toBe(20); // min(20.5, 20)
  });
});
