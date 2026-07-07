"""Pooled gradient-boosted quantile model + contract-shaped forecast.

One model across ALL cards. Three LightGBM quantile regressors (p10/p50/p90)
predict the *cumulative* log-return at the requested horizon from cross-sectional
features; the daily path and confidence band are reconstructed by interpolating
in log-price space, which is exactly the shape the frontend already renders.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor

from .config import MAX_HORIZON, MODEL_FILE
from .features import CATEGORICAL_FEATURES, FEATURES, as_model_frame, inference_row

QUANTILES = {"lower": 0.10, "mid": 0.50, "upper": 0.90}


@dataclass
class PooledForecaster:
    version: str = "pooled-lgbm-v1"
    trained_at: str | None = None
    n_train_rows: int = 0
    metrics: dict = field(default_factory=dict)
    models: dict = field(default_factory=dict)  # quantile-name -> LGBMRegressor

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "PooledForecaster":
        Xm = as_model_frame(X)
        for name, q in QUANTILES.items():
            reg = LGBMRegressor(
                objective="quantile",
                alpha=q,
                n_estimators=400,
                learning_rate=0.05,
                num_leaves=31,
                min_child_samples=20,
                subsample=0.8,
                colsample_bytree=0.8,
                verbosity=-1,
            )
            reg.fit(Xm, y, categorical_feature=CATEGORICAL_FEATURES)
            self.models[name] = reg
        return self

    def _predict_quantiles(self, X: pd.DataFrame) -> dict:
        Xm = as_model_frame(X)
        preds = {name: float(self.models[name].predict(Xm)[0]) for name in QUANTILES}
        # Enforce monotone quantiles (p10 <= p50 <= p90).
        lo, mid, hi = sorted((preds["lower"], preds["mid"], preds["upper"]))
        return {"lower": lo, "mid": mid, "upper": hi}

    def save(self, path=MODEL_FILE) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)

    @staticmethod
    def load(path=MODEL_FILE) -> "PooledForecaster":
        return joblib.load(path)

    def is_ready(self) -> bool:
        return len(self.models) == len(QUANTILES)


def forecast_card(model: PooledForecaster, card_df: pd.DataFrame, horizon: int) -> dict | None:
    """Return the forecast contract for one card, or None if not forecastable."""
    horizon = max(1, min(MAX_HORIZON, int(horizon)))
    feat = inference_row(card_df, horizon)
    if feat is None:
        return None

    q = model._predict_quantiles(pd.DataFrame([feat]))
    last_day = card_df["day"].max()
    last_price = float(card_df.sort_values("day")["price"].iloc[-1])
    if last_price <= 0:
        return None

    forecast = []
    for k in range(1, horizon + 1):
        f = k / horizon  # interpolate the cumulative return along the path
        predicted = last_price * np.exp(q["mid"] * f)
        lower = last_price * np.exp(q["lower"] * f)
        upper = last_price * np.exp(q["upper"] * f)
        forecast.append(
            {
                "date": (last_day + timedelta(days=k)).strftime("%Y-%m-%d"),
                "predicted": round(float(max(0.0, predicted)), 2),
                "lower": round(float(max(0.0, lower)), 2),
                "upper": round(float(max(0.0, upper)), 2),
            }
        )

    # Band width (in return space) at the horizon -> a 0..1 confidence signal.
    width = float(np.exp(q["upper"]) - np.exp(q["lower"]))
    confidence = round(float(np.exp(-width)), 3)  # width 0 -> 1.0, wide -> 0
    projected_change_pct = round(float((np.exp(q["mid"]) - 1.0) * 100.0), 2)
    trend_per_day = round((forecast[-1]["predicted"] - last_price) / horizon, 4)

    return {
        "forecast": forecast,
        "model": model.version,
        "trendPerDay": trend_per_day,
        "confidence": confidence,
        "projectedChangePct": projected_change_pct,
    }


def _feature_names() -> list[str]:
    return FEATURES
