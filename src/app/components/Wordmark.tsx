"use client";

import { Box, Typography } from "@mui/material";

/**
 * The Foil Alpha wordmark — "Foil" in ink, "Alpha" in the Holo iridescent
 * gradient. The brand's signature moment; replaces the legacy hosted logo.
 */
export default function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.6, userSelect: "none" }}>
      <Typography component="span" sx={{ fontWeight: 800, fontSize: size, letterSpacing: "-0.03em", lineHeight: 1 }}>
        Foil
      </Typography>
      <Typography
        component="span"
        sx={{
          fontWeight: 800,
          fontSize: size,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          background: (t) => t.foil.gradient,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Alpha
      </Typography>
    </Box>
  );
}
