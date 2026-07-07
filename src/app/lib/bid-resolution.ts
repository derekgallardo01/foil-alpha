/**
 * eBay-style proxy (auto) bid resolution — pure, no DB.
 *
 * A bid carries a visible `amount` and an optional `max` ceiling. The system
 * keeps the highest-max bidder winning at just over the runner-up, never above
 * the winner's own max. A plain bid has `max == amount`, so it simply pays what
 * was entered (first-price) — the proxy math collapses to today's behavior.
 *
 * The caller keeps the invariant `frozen escrow == effective amount`, so these
 * functions only decide the *effective* prices; the endpoint applies the freezes.
 */

export const BID_INCREMENT = 0.5;

export interface ProxyResolution {
  challengerWins: boolean;
  /** The challenger's new effective (== their frozen hold). */
  challengerEffective: number;
  /** The standing top bidder's new effective (0 when there was no top bid). */
  topEffective: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Resolve a new bid against the current highest OTHER active bid.
 * @param top the current top bid's effective + max, or null if the challenger is first.
 */
export function resolveProxyBid(params: {
  challengerAmount: number;
  challengerMax: number;
  reserve: number;
  top: { effective: number; max: number } | null;
  increment?: number;
}): ProxyResolution {
  const inc = params.increment ?? BID_INCREMENT;
  const { challengerAmount, challengerMax, reserve } = params;

  if (!params.top) {
    // First/only bidder: pays their entered amount (at least the reserve); the
    // max is kept only as a ceiling to defend against future bids.
    return {
      challengerWins: true,
      challengerEffective: Math.max(challengerAmount, reserve),
      topEffective: 0,
    };
  }

  const { effective: topEff, max: topMax } = params.top;

  if (challengerMax > topMax) {
    // Challenger's ceiling beats the standing ceiling: they win at just over the
    // standing max, floored at their own entered amount and capped at their max.
    return {
      challengerWins: true,
      challengerEffective: clamp(topMax + inc, challengerAmount, challengerMax),
      topEffective: topMax, // standing bidder pushed to their max — and loses
    };
  }

  // Standing ceiling holds: challenger is immediately outbid at their own max,
  // and the standing bidder is auto-raised to just over the challenger.
  return {
    challengerWins: false,
    challengerEffective: challengerMax,
    topEffective: clamp(challengerMax + inc, topEff, topMax),
  };
}
