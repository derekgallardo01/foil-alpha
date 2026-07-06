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
