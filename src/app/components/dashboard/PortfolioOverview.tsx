"use client";

import { Card, CardContent, Box, Typography, Tooltip, Divider } from "@mui/material";
import { WorkspacePremium, Inventory2, Style } from "@mui/icons-material";
import Grid from "@mui/material/Grid2";
import { formatPrice } from "../../lib/format";

export interface PortfolioSummary {
  totalValue: number;
  totalUnits: number;
  totalLines: number;
  cardCount: number;
  sealedCount: number;
  gradedCount: number;
}

export interface PortfolioTopItem {
  name: string;
  value: number;
  image?: string | null;
  graded: boolean;
  sealed: boolean;
  setName?: string | null;
}

// Cards / Sealed / Graded are mutually exclusive here (raw cards = cards minus
// the graded subset), so the three segments sum to the total line count.
// Colors are the app's own accent tokens (validated: CVD ΔE 48, contrast pass).
const SEGMENTS = [
  { key: "cards", label: "Cards", color: "primary.main", icon: <Style sx={{ fontSize: 15 }} /> },
  { key: "sealed", label: "Sealed", color: "info.main", icon: <Inventory2 sx={{ fontSize: 15 }} /> },
  { key: "graded", label: "Graded", color: "warning.main", icon: <WorkspacePremium sx={{ fontSize: 15 }} /> },
] as const;

export default function PortfolioOverview({
  summary,
  topItems,
}: {
  summary: PortfolioSummary;
  topItems: PortfolioTopItem[];
}) {
  const counts: Record<string, number> = {
    cards: Math.max(0, summary.cardCount - summary.gradedCount),
    sealed: summary.sealedCount,
    graded: summary.gradedCount,
  };
  const segments = SEGMENTS.map((s) => ({ ...s, count: counts[s.key] })).filter((s) => s.count > 0);
  const total = segments.reduce((a, s) => a + s.count, 0) || 1;
  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <Grid container spacing={3}>
      {/* Holdings breakdown */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: "100%" }}>
          <CardContent>
            <Typography variant="overline" sx={{ color: "text.disabled" }}>
              Holdings
            </Typography>
            <Typography variant="mono" component="div" sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, mb: 2 }}>
              {summary.totalUnits.toLocaleString()}{" "}
              <Box component="span" sx={{ fontSize: 14, color: "text.secondary", fontWeight: 500 }}>
                items · {summary.totalLines.toLocaleString()} listings
              </Box>
            </Typography>

            {/* Stacked bar (2px surface gaps between fills) */}
            <Box sx={{ display: "flex", gap: "2px", height: 26, borderRadius: 1, overflow: "hidden", mb: 2 }}>
              {segments.map((s) => (
                <Tooltip key={s.key} title={`${s.label}: ${s.count.toLocaleString()} (${pct(s.count)}%)`} arrow>
                  <Box sx={{ width: `${(s.count / total) * 100}%`, bgcolor: s.color, minWidth: 3 }} />
                </Tooltip>
              ))}
            </Box>

            {/* Legend — text in text tokens, colored dot carries identity */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {segments.map((s) => (
                <Box key={s.key} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: s.color, flexShrink: 0 }} />
                  <Box sx={{ color: s.color, display: "flex" }}>{s.icon}</Box>
                  <Typography variant="body2" sx={{ color: "text.primary" }}>
                    {s.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", ml: 0.5 }}>
                    {pct(s.count)}%
                  </Typography>
                  <Typography variant="mono" sx={{ ml: "auto", fontWeight: 700, color: "text.primary" }}>
                    {s.count.toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Most valuable */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: "100%" }}>
          <CardContent>
            <Typography variant="overline" sx={{ color: "text.disabled" }}>
              Most Valuable
            </Typography>
            <Typography variant="mono" component="div" sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: "primary.main", mb: 1.5 }}>
              {formatPrice(summary.totalValue)}
            </Typography>

            {topItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No priced items yet.</Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {topItems.map((it, i) => (
                  <Box key={i}>
                    {i > 0 && <Divider />}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
                      <Box
                        component="img"
                        src={it.image || "/placeholder-card.png"}
                        alt={it.name}
                        onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-card.png"; }}
                        sx={{ width: 34, height: 46, objectFit: "contain", borderRadius: 0.5, bgcolor: "background.default", flexShrink: 0 }}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                          {it.name.trim()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                          {[it.setName?.trim(), it.graded ? "Graded" : it.sealed ? "Sealed" : null].filter(Boolean).join(" · ")}
                        </Typography>
                      </Box>
                      <Typography variant="mono" sx={{ fontWeight: 700, color: "success.main", flexShrink: 0 }}>
                        {formatPrice(it.value)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
