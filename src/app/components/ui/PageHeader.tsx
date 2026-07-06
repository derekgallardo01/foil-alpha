"use client";

import { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import GradientHeading from "./GradientHeading";

/**
 * Consistent, responsive page header: title (optionally Holo gradient) + icon +
 * a right-aligned actions slot that wraps on small screens. Replaces the
 * gradient-H4 headers re-implemented across pages.
 */
export default function PageHeader({
  title,
  icon,
  actions,
  subtitle,
  gradient = true,
}: {
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  subtitle?: ReactNode;
  gradient?: boolean;
}) {
  return (
    <Box
      component="header"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
        px: { xs: 2, md: 3 },
        pt: 3,
        pb: 1,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        {icon && <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>}
        {gradient ? (
          <GradientHeading variant="h4" component="h1">
            {title}
          </GradientHeading>
        ) : (
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
        )}
      </Box>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
          {subtitle}
        </Typography>
      )}
      {actions && (
        <Box sx={{ ml: { sm: "auto" }, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
