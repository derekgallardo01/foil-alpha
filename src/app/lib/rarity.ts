/**
 * Canonical mapping from a card rarity to a MUI Chip/palette color. Replaces the
 * ~10 near-identical local `getRarityColor` copies scattered across pages.
 */
export type ChipColor = "default" | "primary" | "secondary" | "success" | "error" | "warning" | "info";

export function getRarityColor(rarity: string | null | undefined): ChipColor {
  switch ((rarity ?? "").toLowerCase()) {
    case "common":
      return "default";
    case "uncommon":
      return "success";
    case "rare":
      return "primary";
    case "rare holo":
    case "holo rare":
      return "secondary";
    case "ultra rare":
    case "secret rare":
      return "error";
    default:
      return "default";
  }
}

// Hex variants for chips that render a raw `bgcolor` (dashboard tables) rather
// than a MUI palette color prop. Consolidates the byte-identical local copies.
const RARITY_HEX: Record<string, string> = {
  Common: "#757575",
  Uncommon: "#66BB6A",
  Rare: "#42A5F5",
  "Rare Holo": "#AB47BC",
  "Ultra Rare": "#FF7043",
  "Secret Rare": "#EF5350",
  VMAX: "#9B5Cff",
  VSTAR: "#FFD54F",
  Promo: "#9C27B0",
};

export function getRarityHex(rarity: string | null | undefined): string {
  return RARITY_HEX[rarity ?? ""] || "#757575";
}

const CONDITION_HEX: Record<string, string> = {
  Mint: "#4CAF50",
  "Near Mint": "#8BC34A",
  Excellent: "#FFC107",
  Good: "#FF9800",
  Fair: "#FF5722",
  Poor: "#F44336",
};

export function getConditionColor(condition: string | null | undefined): string {
  return CONDITION_HEX[condition ?? ""] || "#757575";
}
