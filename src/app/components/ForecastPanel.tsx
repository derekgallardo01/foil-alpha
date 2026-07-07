"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { TrendingUp, ArrowDropUp, ArrowDropDown } from "@mui/icons-material";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface ForecastResponse {
  history: { date: string; price: number }[];
  forecast: { date: string; predicted: number; lower: number; upper: number }[];
  model: string;
  confidence: number;
  projectedChangePct: number | null;
  points: number;
}

export default function ForecastPanel({ cardId, title = "Price Forecast" }: { cardId: number; title?: string }) {
  const theme = useTheme();
  const [horizon, setHorizon] = useState(90);
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/forecast?card_id=${cardId}&days=${horizon}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [cardId, horizon]);

  const chartData: Array<Record<string, unknown>> = [];
  if (data?.history) {
    for (const h of data.history) chartData.push({ date: h.date, price: h.price });
    if (data.forecast?.length && data.history.length) {
      // anchor the dashed forecast line to the last observed price
      chartData[chartData.length - 1].predicted = data.history[data.history.length - 1].price;
      for (const f of data.forecast)
        chartData.push({ date: f.date, predicted: f.predicted, band: [f.lower, f.upper] });
    }
  }

  const up = (data?.projectedChangePct ?? 0) >= 0;
  const hasForecast = !!data?.forecast?.length;
  const fmt$ = (v: number) => `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
          <TrendingUp sx={{ color: "primary.main" }} fontSize="small" />
          <Typography variant="h6">{title}</Typography>
          {hasForecast && data?.projectedChangePct !== null && (
            <Chip
              size="small"
              icon={up ? <ArrowDropUp /> : <ArrowDropDown />}
              label={`${up ? "+" : ""}${data?.projectedChangePct}% / ${horizon}d`}
              sx={{
                fontFamily: theme.typography.mono?.fontFamily,
                color: up ? "success.main" : "error.main",
                bgcolor: up ? "rgba(61,220,132,0.12)" : "rgba(255,92,108,0.12)",
                "& .MuiChip-icon": { color: "inherit" },
              }}
            />
          )}
          {hasForecast && (
            <Chip
              size="small"
              variant="outlined"
              label={`confidence ${Math.round((data?.confidence ?? 0) * 100)}%`}
            />
          )}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={horizon}
            onChange={(_, v) => v && setHorizon(v)}
            sx={{ ml: "auto" }}
          >
            {[30, 90, 180].map((h) => (
              <ToggleButton key={h} value={h} sx={{ px: 1.25, fontFamily: theme.typography.mono?.fontFamily }}>
                {h}d
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {loading ? (
          <Box sx={{ height: { xs: 240, md: 300 }, display: "grid", placeItems: "center" }}>
            <CircularProgress sx={{ color: "primary.main" }} />
          </Box>
        ) : !hasForecast ? (
          <Box sx={{ height: { xs: 240, md: 300 }, display: "grid", placeItems: "center", textAlign: "center", px: 3 }}>
            <Box>
              <Typography color="text.secondary">Not enough price history to forecast yet.</Typography>
              <Typography variant="caption" color="text.disabled">
                Forecasts sharpen as daily price data accumulates ({data?.points ?? 0} points so far).
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ height: { xs: 260, md: 320 } }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                  stroke={theme.palette.divider}
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                  stroke={theme.palette.divider}
                  tickFormatter={fmt$}
                  width={54}
                />
                <Tooltip
                  contentStyle={{
                    background: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                    color: theme.palette.text.primary,
                    fontFamily: theme.typography.mono?.fontFamily as string,
                    fontSize: 12,
                  }}
                  formatter={(value: number | string, name: string) => {
                    if (name === "band") return [null, null];
                    const label = name === "price" ? "Actual" : "Forecast";
                    return [fmt$(Number(value)), label];
                  }}
                />
                <Area
                  dataKey="band"
                  stroke="none"
                  fill={theme.palette.primary.main}
                  fillOpacity={0.12}
                  isAnimationActive={false}
                  connectNulls
                />
                <Line
                  dataKey="price"
                  stroke={theme.palette.primary.main}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
                <Line
                  dataKey="predicted"
                  stroke={theme.palette.secondary.main}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        )}

        {hasForecast && (
          <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
            Model: {data?.model} · statistical baseline. A dedicated ML service will replace this with
            richer models as price history deepens.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
