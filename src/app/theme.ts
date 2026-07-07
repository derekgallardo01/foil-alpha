import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import type { CSSProperties } from "react";
import "@fontsource-variable/sora";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";

/**
 * Foil Alpha design system — "Terminal + Holo".
 *
 * Terminal supplies the calm, data-legible dark base (deep blue-black ground,
 * monospaced numerics, real market up/down semantics). Holo supplies the
 * signature iridescence (`theme.foil.gradient`) reserved for brand moments —
 * the wordmark, card spotlights, rare-pull states — NOT flooded everywhere.
 *
 * Consume tokens through the theme (`theme.palette.*`, `theme.foil.*`,
 * `variant="mono"`), never hardcoded hex, so the whole app reskins from here.
 */

const FONT_DISPLAY = '"Sora Variable", "Sora", system-ui, sans-serif';
const FONT_BODY = '"Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_MONO = '"JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, Consolas, monospace';

// Terminal ground + Holo accent
const COLOR = {
  ground: "#0A0E15",
  surface: "#111823",
  surface2: "#18202D",
  line: "#1E2836",
  line2: "#2A3547",
  ink: "#E7EEF6",
  inkDim: "#8FA0B4",
  // Raised from #5E6E82 (~3.4:1) so it clears WCAG AA on the dark ground —
  // it's used for real labels (StatCard, nav section headers), not just
  // disabled controls.
  inkFaint: "#8090A4",
  holoViolet: "#9B5Cff",
  signal: "#FFC24B",
  up: "#3DDC84",
  down: "#FF5C6C",
  cyan: "#22D3EE",
};

// Module augmentation: custom foil gradient tokens, market palette colors, mono variant.
declare module "@mui/material/styles" {
  interface Theme {
    foil: { gradient: string; gradientSoft: string; sheen: string };
  }
  interface ThemeOptions {
    foil?: { gradient?: string; gradientSoft?: string; sheen?: string };
  }
  interface Palette {
    up: Palette["primary"];
    down: Palette["primary"];
    signal: Palette["primary"];
  }
  interface PaletteOptions {
    up?: PaletteOptions["primary"];
    down?: PaletteOptions["primary"];
    signal?: PaletteOptions["primary"];
  }
  interface TypographyVariants {
    mono: CSSProperties;
  }
  interface TypographyVariantsOptions {
    mono?: CSSProperties;
  }
}
declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    mono: true;
  }
}

let theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: COLOR.holoViolet, contrastText: "#0B0714" },
    secondary: { main: COLOR.signal, contrastText: "#0A0E15" },
    success: { main: COLOR.up, contrastText: "#04140B" },
    error: { main: COLOR.down, contrastText: "#1A0406" },
    warning: { main: COLOR.signal, contrastText: "#0A0E15" },
    info: { main: COLOR.cyan, contrastText: "#04141A" },
    background: { default: COLOR.ground, paper: COLOR.surface },
    text: { primary: COLOR.ink, secondary: COLOR.inkDim, disabled: COLOR.inkFaint },
    divider: COLOR.line,
    action: {
      hover: "rgba(155,92,255,0.08)",
      selected: "rgba(155,92,255,0.14)",
      active: COLOR.holoViolet,
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: FONT_BODY,
    h1: { fontFamily: FONT_DISPLAY, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.02 },
    h2: { fontFamily: FONT_DISPLAY, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.06 },
    h3: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 },
    h4: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: "-0.015em" },
    h5: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontFamily: FONT_DISPLAY, fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600, color: COLOR.inkDim },
    body1: { fontFamily: FONT_BODY, lineHeight: 1.55 },
    body2: { fontFamily: FONT_BODY, lineHeight: 1.5 },
    button: { fontFamily: FONT_BODY, fontWeight: 600, textTransform: "none", letterSpacing: 0 },
    overline: {
      fontFamily: FONT_MONO,
      fontWeight: 600,
      fontSize: "0.68rem",
      letterSpacing: "0.16em",
      textTransform: "uppercase",
    },
    caption: { fontFamily: FONT_BODY, color: COLOR.inkDim },
  },
});

theme = createTheme(theme, {
  palette: {
    up: theme.palette.augmentColor({ color: { main: COLOR.up }, name: "up" }),
    down: theme.palette.augmentColor({ color: { main: COLOR.down }, name: "down" }),
    signal: theme.palette.augmentColor({ color: { main: COLOR.signal }, name: "signal" }),
  },
  foil: {
    gradient: `linear-gradient(92deg, #FF4D9D, ${COLOR.holoViolet} 32%, ${COLOR.cyan} 64%, #A3E635)`,
    gradientSoft:
      "linear-gradient(135deg, rgba(255,77,157,0.16), rgba(155,92,255,0.16) 40%, rgba(34,211,238,0.16))",
    sheen:
      "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.28) 47%, transparent 62%)",
  },
  typography: {
    mono: {
      fontFamily: FONT_MONO,
      fontFeatureSettings: '"tnum" 1',
      letterSpacing: "0.01em",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body": { backgroundColor: COLOR.ground },
        body: { WebkitFontSmoothing: "antialiased", textRendering: "optimizeLegibility" },
        "::selection": { background: "rgba(155,92,255,0.32)" },
        "@keyframes pulse": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.45 },
        },
        "*::-webkit-scrollbar": { width: 10, height: 10 },
        "*::-webkit-scrollbar-thumb": {
          background: COLOR.line2,
          borderRadius: 8,
          border: `2px solid ${COLOR.ground}`,
        },
        "*::-webkit-scrollbar-track": { background: "transparent" },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: COLOR.line },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: COLOR.surface,
          border: `1px solid ${COLOR.line}`,
          borderRadius: 14,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, paddingInline: 16, paddingBlock: 8 },
        containedPrimary: { color: "#0B0714" },
        outlined: { borderColor: COLOR.line2 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: FONT_MONO, fontWeight: 600, letterSpacing: "0.02em" },
        outlined: { borderColor: COLOR.line2 },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "default" },
      styleOverrides: {
        root: {
          backgroundColor: "rgba(10,14,21,0.72)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${COLOR.line}`,
        },
      },
    },
    MuiTextField: { defaultProps: { variant: "outlined", size: "small" } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: COLOR.surface2, border: `1px solid ${COLOR.line2}`, fontSize: 12 },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: COLOR.line } } },
  },
});

// Scale headings (and other variants) down on narrow viewports so long titles
// like "Card Marketplace" don't overflow on phones. Custom variants (mono) and
// inline fontSize overrides are unaffected.
export default responsiveFontSizes(theme);
