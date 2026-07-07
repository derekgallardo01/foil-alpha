"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import { History, Science, CloudDownload } from "@mui/icons-material";

interface BackfillSummary {
  dryRun: boolean;
  cardsConsidered: number;
  cardsWithHistory: number;
  cardsFailed: number;
  pointsInserted: number;
  pointsSkippedExisting: number;
  perCard: Array<{
    cardId: number;
    name: string;
    totalDataPoints: number | null;
    earliestDate: string | null;
    latestDate: string | null;
    pointsFound: number;
    inserted: number;
    error?: string;
  }>;
}

/**
 * Phase 2a data-acquisition control: probe how deep the V2 price history is, or
 * backfill the full time series into `price_history` for the forecasting model.
 * Talks to POST /api/cards/backfill-price-history (admin-guarded).
 */
export default function BackfillPriceHistoryCard() {
  const [loading, setLoading] = useState<"probe" | "backfill" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BackfillSummary | null>(null);

  const run = async (mode: "probe" | "backfill") => {
    setLoading(mode);
    setError(null);
    setSummary(null);
    try {
      const body =
        mode === "probe" ? { limit: 1, dryRun: true } : {}; // {} = all cards, live
      const res = await fetch("/api/cards/backfill-price-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setSummary(data as BackfillSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
          <History />
          Forecasting Data (Phase 2)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The daily sync only keeps the latest price. Backfill pulls each card&apos;s full price
          history (with volume) so the ML forecasting model has real data to learn from.
        </Typography>

        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: summary || error ? 2 : 0 }}>
          <Button
            variant="outlined"
            startIcon={loading === "probe" ? <CircularProgress size={16} /> : <Science />}
            onClick={() => run("probe")}
            disabled={loading !== null}
          >
            Probe one card (dry run)
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={loading === "backfill" ? <CircularProgress size={16} /> : <CloudDownload />}
            onClick={() => run("backfill")}
            disabled={loading !== null}
          >
            Backfill all cards
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: summary ? 2 : 0 }}>
            {error}
          </Alert>
        )}

        {summary && (
          <Box>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
              <Chip size="small" label={summary.dryRun ? "Dry run" : "Live run"} color={summary.dryRun ? "default" : "success"} />
              <Chip size="small" variant="outlined" label={`${summary.cardsConsidered} cards`} />
              <Chip size="small" variant="outlined" label={`${summary.cardsWithHistory} with history`} />
              <Chip size="small" variant="outlined" label={`${summary.pointsInserted} inserted`} />
              <Chip size="small" variant="outlined" label={`${summary.pointsSkippedExisting} skipped`} />
              {summary.cardsFailed > 0 && (
                <Chip size="small" color="error" label={`${summary.cardsFailed} failed`} />
              )}
            </Box>
            {summary.perCard.slice(0, 5).map((c) => (
              <Typography
                key={c.cardId}
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", fontFamily: "monospace" }}
              >
                #{c.cardId} {c.name}: {c.pointsFound} pts
                {c.totalDataPoints != null ? ` (API reports ${c.totalDataPoints}` : ""}
                {c.earliestDate ? `, since ${c.earliestDate.slice(0, 10)})` : c.totalDataPoints != null ? ")" : ""}
                {c.error ? ` — ${c.error}` : ""}
              </Typography>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
