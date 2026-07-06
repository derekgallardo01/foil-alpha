"use client";

import { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

/**
 * Designed empty state: icon + heading + optional description + optional action.
 * Replaces the bare "No items" one-liners and the hand-rolled empty blocks.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  minHeight = 280,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  minHeight?: number | string;
}) {
  return (
    <Box sx={{ minHeight, display: "grid", placeItems: "center", textAlign: "center", px: 3, py: 5 }}>
      <Box sx={{ maxWidth: 440 }}>
        {icon && (
          <Box sx={{ color: "text.secondary", mb: 1.5, "& svg": { fontSize: 48 } }}>{icon}</Box>
        )}
        <Typography variant="h6" sx={{ mb: description ? 0.5 : action ? 2 : 0 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: action ? 2.5 : 0 }}>
            {description}
          </Typography>
        )}
        {action}
      </Box>
    </Box>
  );
}
