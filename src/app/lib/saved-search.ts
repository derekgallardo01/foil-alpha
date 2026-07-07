import { prisma } from "./prisma";
import { createNotification } from "./notification";
import { emitAppEvent } from "./events";

export interface SavedSearchQuery {
  search?: string;
  set?: string;
  rarity?: string;
  price_min?: number;
  price_max?: number;
}

/**
 * Pure: does a card/listing match a saved search? Empty criteria are wildcards.
 * A price filter with no listing price is treated as a non-match.
 */
export function matchesSavedSearch(
  q: SavedSearchQuery,
  card: { name: string; set_name: string; rarity: string },
  price: number | null
): boolean {
  if (q.search && !card.name.toLowerCase().includes(q.search.toLowerCase())) return false;
  if (q.set && card.set_name !== q.set) return false;
  if (q.rarity && card.rarity !== q.rarity) return false;
  const hasPriceFilter = q.price_min != null || q.price_max != null;
  if (hasPriceFilter) {
    if (price == null) return false;
    if (q.price_min != null && price < q.price_min) return false;
    if (q.price_max != null && price > q.price_max) return false;
  }
  return true;
}

/**
 * Notify every user (except the seller) whose saved search matches a newly-listed
 * card. At most one notification per user per listing. Best-effort.
 */
export async function notifySavedSearchMatches(
  userCardId: number,
  card: { name: string; set_name: string; rarity: string },
  price: number | null,
  sellerId: number
): Promise<void> {
  const searches = await prisma.savedSearch.findMany({ where: { user_id: { not: sellerId } } });
  const notified = new Set<number>();
  for (const s of searches) {
    if (notified.has(s.user_id)) continue;
    const q = (s.query as SavedSearchQuery) ?? {};
    if (!matchesSavedSearch(q, card, price)) continue;
    notified.add(s.user_id);
    try {
      await createNotification({
        user_id: s.user_id,
        type: "SAVED_SEARCH_MATCH",
        title: "New match for your saved search",
        message: `A new listing matches "${s.name}": ${card.name}.`,
        data: { card_name: card.name, user_card_id: userCardId, saved_search: s.name },
      });
    } catch (e) {
      console.error("Saved-search notify failed:", e);
    }
  }
  if (notified.size > 0) emitAppEvent({ type: "notification" });
}
