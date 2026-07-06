"use client";

import React from "react";
import { Card, CardContent, Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { ArrowDropUp, ArrowDropDown } from "@mui/icons-material";

/**
 * A metric tile in the Terminal style: neutral surface, monospaced value,
 * optional up/down delta with market semantics, and an optional Holo accent
 * hairline for the hero metric.
 */
export default function StatCard({
  label,
  value,
  delta,
  accent = false,
  icon,
}: {
  label: string;
  value: string | number;
  delta?: number;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  const theme = useTheme();
  const up = (delta ?? 0) >= 0;

  return (
    <Card
      sx={{
        position: "relative",
        overflow: "hidden",
        height: "100%",
        ...(accent && {
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: theme.foil.gradient,
          },
        }),
      }}
    >
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {icon && (
            <Box sx={{ color: accent ? "primary.main" : "text.disabled", display: "flex" }}>{icon}</Box>
          )}
          <Typography variant="overline" sx={{ color: "text.disabled" }}>
            {label}
          </Typography>
        </Box>

        <Typography
          variant="mono"
          component="div"
          sx={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: accent ? "primary.main" : "text.primary" }}
        >
          {value}
        </Typography>

        {delta !== undefined && (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.25,
              alignSelf: "flex-start",
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              color: up ? "success.main" : "error.main",
              bgcolor: up ? "rgba(61,220,132,0.12)" : "rgba(255,92,108,0.12)",
            }}
          >
            {up ? <ArrowDropUp fontSize="small" /> : <ArrowDropDown fontSize="small" />}
            <Typography variant="mono" sx={{ fontSize: 12.5, fontWeight: 600 }}>
              {Math.abs(delta).toFixed(1)}%
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
