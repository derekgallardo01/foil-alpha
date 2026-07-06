"use client";

import { Typography, TypographyProps } from "@mui/material";

/**
 * The Holo gradient heading treatment in one place, with a robust solid-color
 * fallback: the transparent text-fill is only applied where background-clip:text
 * is supported, so the text can never become invisible.
 */
export default function GradientHeading({ children, sx, ...props }: TypographyProps) {
  return (
    <Typography
      {...props}
      sx={{
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: "primary.main",
        "@supports ((-webkit-background-clip: text) or (background-clip: text))": {
          background: (t) => t.foil.gradient,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        },
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}
