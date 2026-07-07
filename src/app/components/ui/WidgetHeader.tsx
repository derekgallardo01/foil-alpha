"use client";

import { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

/**
 * The recurring dashboard-widget header: an h6 title (with a leading icon and
 * optional inline chips) on the left, a wrapping controls cluster on the right.
 * Collapses the ~identical `space-between + flexWrap` header Box reimplemented
 * across the dashboard widgets. Sibling to the page-level `ui/PageHeader`.
 */
export default function WidgetHeader({
  title,
  icon,
  actions,
  mb = 3,
}: {
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  mb?: number;
}) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb, flexWrap: "wrap", gap: 1 }}>
      <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {icon}
        {title}
      </Typography>
      {actions != null && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
