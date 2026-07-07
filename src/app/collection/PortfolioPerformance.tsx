"use client";

import { useMemo } from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { TrendingUp, TrendingDown } from "@mui/icons-material";
import StatCard from "../components/StatCard";
import { formatPrice, formatPct } from "../lib/format";
import type { EnhancedUserCard } from "./collection-client";

/**
 * Portfolio performance: cost-basis P/L and top gainers/losers, computed from
 * the cards that have BOTH a known purchase price and a current market price
 * (the only ones with a meaningful unrealized gain/loss). Renders nothing until
 * at least one such card exists, so a collection with no cost basis is unaffected.
 */
export default function PortfolioPerformance({ cards }: { cards: EnhancedUserCard[] }) {
  const stats = useMemo(() => {
    const withBasis = cards.filter(
      (c) => (c.original_purchase_price || 0) > 0 && (c.card.market_price || 0) > 0 && !c.is_sold
    );
    let value = 0;
    let cost = 0;
    for (const c of withBasis) {
      const q = c.quantity || 1;
      value += (c.card.market_price || 0) * q;
      cost += (c.original_purchase_price || 0) * q;
    }
    const pl = value - cost;
    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
    const ranked = [...withBasis].sort((a, b) => (b.profit_loss || 0) - (a.profit_loss || 0));
    const gainers = ranked.filter((c) => (c.profit_loss || 0) > 0).slice(0, 5);
    const losers = ranked
      .filter((c) => (c.profit_loss || 0) < 0)
      .slice(-5)
      .reverse();
    return { count: withBasis.length, value, cost, pl, plPct, gainers, losers };
  }, [cards]);

  if (stats.count === 0) return null;

  const MoverRow = ({ c }: { c: EnhancedUserCard }) => {
    const pl = c.profit_loss || 0;
    const up = pl >= 0;
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          py: 0.75,
          borderBottom: 1,
          borderColor: "divider",
          "&:last-child": { borderBottom: "none" },
        }}
      >
        <Box sx={{ minWidth: 0, mr: 1 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {c.card.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {c.card.set_name}
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right", whiteSpace: "nowrap" }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: up ? "success.main" : "error.main" }}>
            {up ? "+" : "−"}
            {formatPrice(Math.abs(pl))}
          </Typography>
          <Typography variant="caption" sx={{ color: up ? "success.main" : "error.main" }}>
            {formatPct(c.profit_loss_percentage ?? 0)}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Cost Basis" value={formatPrice(stats.cost)} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Current Value" value={formatPrice(stats.value)} accent />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Unrealized P/L"
            value={`${stats.pl >= 0 ? "+" : "−"}${formatPrice(Math.abs(stats.pl))}`}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Return" value={formatPct(stats.plPct)} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <TrendingUp color="success" fontSize="small" />
                <Typography variant="subtitle2">Top gainers</Typography>
              </Box>
              {stats.gainers.length ? (
                stats.gainers.map((c) => <MoverRow key={c.id} c={c} />)
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No gainers yet.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <TrendingDown color="error" fontSize="small" />
                <Typography variant="subtitle2">Top losers</Typography>
              </Box>
              {stats.losers.length ? (
                stats.losers.map((c) => <MoverRow key={c.id} c={c} />)
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No losers — nice.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
