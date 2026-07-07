"""Feature engineering shared by training and inference (no skew).

Each card's daily series is resampled to a regular calendar-day grid (forward
-filled price, zero-filled volume) so horizon lookups and rolling windows are
well defined even when the raw history is sparse. Features are computed as-of a
point in time from ONLY past data; the target is the forward log-return.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import MIN_HISTORY_POINTS, TRAIN_HORIZONS

NUMERIC_FEATURES = [
    "log_price",
    "ret_7",
    "ret_30",
    "ret_90",
    "vol_30",
    "vlog_avg_7",
    "vlog_avg_30",
    "vol_trend",
    "maturity",
    "span_days",
    "horizon",
]
CATEGORICAL_FEATURES = ["rarity", "set_name", "tcg"]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES


def daily_series(card_df: pd.DataFrame) -> pd.DataFrame:
    """Regular daily grid for one card (assumes a single card_id)."""
    s = card_df.sort_values("day").set_index("day")
    grid = s[["price", "volume"]].resample("D").agg({"price": "mean", "volume": "sum"})
    grid["price"] = grid["price"].ffill()
    grid["volume"] = grid["volume"].fillna(0.0)
    grid = grid.dropna(subset=["price"])
    # Carry the (constant) card metadata along.
    for c in CATEGORICAL_FEATURES:
        val = card_df[c].iloc[0] if len(card_df) else None
        grid[c] = val
    grid["_n_raw"] = len(card_df)
    return grid


def _log_return(prices: np.ndarray, window: int) -> float:
    if len(prices) <= window:
        return 0.0
    a, b = prices[-window - 1], prices[-1]
    if a <= 0 or b <= 0:
        return 0.0
    return float(np.log(b / a))


def features_at(grid: pd.DataFrame, i: int, horizon: int) -> dict | None:
    """Feature row as-of positional index i (inclusive) for a given horizon."""
    if i < MIN_HISTORY_POINTS - 1:
        return None
    past = grid.iloc[: i + 1]
    prices = past["price"].to_numpy(dtype=float)
    vols = past["volume"].to_numpy(dtype=float)
    if prices[-1] <= 0:
        return None

    daily_rets = np.diff(np.log(np.clip(prices[-31:], 1e-6, None)))
    vol_30 = float(np.std(daily_rets)) if daily_rets.size > 1 else 0.0

    v7 = float(np.mean(vols[-7:])) if vols.size else 0.0
    v30 = float(np.mean(vols[-30:])) if vols.size else 0.0
    vol_trend = float((v7 + 1.0) / (v30 + 1.0))

    span_days = (past.index[-1] - past.index[0]).days

    row = {
        "log_price": float(np.log(prices[-1])),
        "ret_7": _log_return(prices, 7),
        "ret_30": _log_return(prices, 30),
        "ret_90": _log_return(prices, 90),
        "vol_30": vol_30,
        "vlog_avg_7": float(np.log1p(v7)),
        "vlog_avg_30": float(np.log1p(v30)),
        "vol_trend": vol_trend,
        "maturity": float(np.log1p(past["_n_raw"].iloc[0])),
        "span_days": float(span_days),
        "horizon": float(horizon),
    }
    for c in CATEGORICAL_FEATURES:
        row[c] = past[c].iloc[-1]
    return row


def build_training_frame(panel: pd.DataFrame, horizons=TRAIN_HORIZONS) -> pd.DataFrame:
    """Assemble (features, target) rows across all cards and as-of points.

    Target y = log(price[t+h] / price[t]); only emitted where a future price at
    t+h exists on the daily grid.
    """
    rows: list[dict] = []
    for _, card_df in panel.groupby("card_id", observed=True):
        grid = daily_series(card_df)
        n = len(grid)
        if n < MIN_HISTORY_POINTS + min(horizons):
            continue
        prices = grid["price"].to_numpy(dtype=float)
        for h in horizons:
            for i in range(MIN_HISTORY_POINTS - 1, n - h):
                p_now, p_fut = prices[i], prices[i + h]
                if p_now <= 0 or p_fut <= 0:
                    continue
                feat = features_at(grid, i, h)
                if feat is None:
                    continue
                feat["y"] = float(np.log(p_fut / p_now))
                rows.append(feat)
    return pd.DataFrame(rows)


def inference_row(card_df: pd.DataFrame, horizon: int) -> dict | None:
    """Latest feature row for a card at the requested horizon (for serving)."""
    grid = daily_series(card_df)
    if len(grid) == 0:
        return None
    return features_at(grid, len(grid) - 1, horizon)


def as_model_frame(rows) -> pd.DataFrame:
    """Coerce a list[dict] (or DataFrame) into the model's expected column dtypes."""
    df = pd.DataFrame(rows) if not isinstance(rows, pd.DataFrame) else rows.copy()
    for c in NUMERIC_FEATURES:
        df[c] = pd.to_numeric(df.get(c), errors="coerce").astype(float)
    for c in CATEGORICAL_FEATURES:
        df[c] = df.get(c).astype("category")
    return df[FEATURES]
