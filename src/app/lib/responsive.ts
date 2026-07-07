/**
 * Shared responsive sx helpers.
 *
 * Hiding a low-value table column on small screens means the *same* display
 * toggle must be applied to both the header cell and every body cell for that
 * column — copy-pasting the literal invites the two drifting apart. Spread these
 * constants instead: `sx={{ ...hideBelowMd }}` (or merge into a larger sx).
 */
import type { SxProps, Theme } from "@mui/material";

/** Hidden below the `md` breakpoint (shown md and up). */
export const hideBelowMd: SxProps<Theme> = { display: { xs: "none", md: "table-cell" } };

/** Hidden below the `sm` breakpoint (shown sm and up). */
export const hideBelowSm: SxProps<Theme> = { display: { xs: "none", sm: "table-cell" } };
