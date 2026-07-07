import { describe, it, expect } from "vitest";
import { getRarityColor, getRarityHex, getConditionColor } from "../rarity";

describe("getRarityColor (MUI ChipColor)", () => {
  it("maps known rarities case-insensitively", () => {
    expect(getRarityColor("common")).toBe("default");
    expect(getRarityColor("Uncommon")).toBe("success");
    expect(getRarityColor("RARE")).toBe("primary");
    expect(getRarityColor("rare holo")).toBe("secondary");
    expect(getRarityColor("ultra rare")).toBe("error");
    expect(getRarityColor("secret rare")).toBe("error");
  });
  it("defaults for unknown/null", () => {
    expect(getRarityColor("Zorp")).toBe("default");
    expect(getRarityColor(null)).toBe("default");
    expect(getRarityColor(undefined)).toBe("default");
  });
});

describe("getRarityHex", () => {
  it("maps known rarities to hex", () => {
    expect(getRarityHex("Common")).toBe("#757575");
    expect(getRarityHex("VMAX")).toBe("#9B5Cff");
    expect(getRarityHex("Secret Rare")).toBe("#EF5350");
  });
  it("falls back to grey for unknown/null", () => {
    expect(getRarityHex("Zorp")).toBe("#757575");
    expect(getRarityHex(null)).toBe("#757575");
  });
});

describe("getConditionColor", () => {
  it("maps known conditions", () => {
    expect(getConditionColor("Mint")).toBe("#4CAF50");
    expect(getConditionColor("Near Mint")).toBe("#8BC34A");
    expect(getConditionColor("Poor")).toBe("#F44336");
  });
  it("falls back to grey for unknown/null", () => {
    expect(getConditionColor("Pristine")).toBe("#757575");
    expect(getConditionColor(null)).toBe("#757575");
  });
});
