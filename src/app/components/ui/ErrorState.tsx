"use client";

import { Alert, Box, Button, Typography } from "@mui/material";
import { ErrorOutline, Refresh } from "@mui/icons-material";

/**
 * Standard fetch-error surface with a Retry affordance. Use `variant="inline"`
 * for a compact Alert inside a section, or the default block for full-panel
 * error states. Critically, this is what pages should render on fetch FAILURE
 * so an outage never masquerades as an empty state.
 */
export default function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  minHeight = 240,
  variant = "block",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  minHeight?: number | string;
  variant?: "block" | "inline";
}) {
  if (variant === "inline") {
    return (
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button color="inherit" size="small" startIcon={<Refresh />} onClick={onRetry}>
              Retry
            </Button>
          )
        }
      >
        {message || title}
      </Alert>
    );
  }

  return (
    <Box sx={{ minHeight, display: "grid", placeItems: "center", textAlign: "center", px: 3, py: 4 }}>
      <Box sx={{ maxWidth: 420 }}>
        <ErrorOutline sx={{ fontSize: 44, color: "error.main", mb: 1 }} />
        <Typography variant="h6" sx={{ mb: message ? 0.5 : 1.5 }}>
          {title}
        </Typography>
        {message && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {message}
          </Typography>
        )}
        {onRetry && (
          <Button variant="outlined" startIcon={<Refresh />} onClick={onRetry}>
            Try again
          </Button>
        )}
      </Box>
    </Box>
  );
}
