import { describe, it, expect } from "vitest";
import { matchesSavedSearch } from "./saved-search";

const card = { name: "Charizard ex", set_name: "151", rarity: "Rare" };

describe("matchesSavedSearch", () => {
  it("empty query matches anything", () => {
    expect(matchesSavedSearch({}, card, 10)).toBe(true);
  });

  it("search term is a case-insensitive substring of the name", () => {
    expect(matchesSavedSearch({ search: "charizard" }, card, 10)).toBe(true);
    expect(matchesSavedSearch({ search: "pikachu" }, card, 10)).toBe(false);
  });

  it("set and rarity must match exactly", () => {
    expect(matchesSavedSearch({ set: "151" }, card, 10)).toBe(true);
    expect(matchesSavedSearch({ set: "Base" }, card, 10)).toBe(false);
    expect(matchesSavedSearch({ rarity: "Rare" }, card, 10)).toBe(true);
    expect(matchesSavedSearch({ rarity: "Common" }, card, 10)).toBe(false);
  });

  it("price range is inclusive", () => {
    expect(matchesSavedSearch({ price_min: 5, price_max: 20 }, card, 10)).toBe(true);
    expect(matchesSavedSearch({ price_min: 5, price_max: 20 }, card, 5)).toBe(true);
    expect(matchesSavedSearch({ price_min: 5, price_max: 20 }, card, 20)).toBe(true);
    expect(matchesSavedSearch({ price_min: 5, price_max: 20 }, card, 4)).toBe(false);
    expect(matchesSavedSearch({ price_min: 5, price_max: 20 }, card, 21)).toBe(false);
  });

  it("a price filter with no listing price is a non-match", () => {
    expect(matchesSavedSearch({ price_max: 20 }, card, null)).toBe(false);
    // but no price filter + no price still matches
    expect(matchesSavedSearch({ rarity: "Rare" }, card, null)).toBe(true);
  });

  it("all specified criteria must match (AND)", () => {
    expect(matchesSavedSearch({ search: "charizard", set: "151", price_max: 20 }, card, 15)).toBe(true);
    expect(matchesSavedSearch({ search: "charizard", set: "151", price_max: 20 }, card, 25)).toBe(false);
  });
});
