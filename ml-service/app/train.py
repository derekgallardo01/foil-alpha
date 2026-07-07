"""Train the pooled forecaster and report holdout quality.

    python -m app.train                 # train on the live DB panel
    python -m app.train --synthetic 200 # smoke-test on generated data (no DB)

Writes models/pooled_forecaster.joblib.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from .config import MIN_HISTORY_POINTS, TRAIN_HORIZONS
from .features import build_training_frame
from .model import QUANTILES, PooledForecaster


def synthetic_panel(n_cards: int = 200, days: int = 220, seed: int = 7) -> pd.DataFrame:
    """Generate a plausible price panel for offline smoke tests."""
    rng = np.random.default_rng(seed)
    rarities = ["Common", "Uncommon", "Rare", "Ultra Rare", "Secret Rare"]
    sets = [f"Set {i}" for i in range(12)]
    start = datetime(2025, 1, 1)
    rows = []
    for cid in range(1, n_cards + 1):
        base = float(rng.uniform(2, 400))
        drift = float(rng.normal(0.0004, 0.0009))
        vol = float(rng.uniform(0.01, 0.05))
        price = base
        rarity = rarities[rng.integers(len(rarities))]
        set_name = sets[rng.integers(len(sets))]
        span = int(rng.integers(MIN_HISTORY_POINTS + max(TRAIN_HORIZONS) + 5, days))
        for d in range(span):
            price = max(0.25, price * np.exp(drift + rng.normal(0, vol)))
            rows.append(
                {
                    "card_id": cid,
                    "day": start + timedelta(days=d),
                    "price": round(price, 2),
                    "volume": float(max(0, rng.normal(20, 8))),
                    "rarity": rarity,
                    "set_name": set_name,
                    "tcg": "pokemon",
                }
            )
    df = pd.DataFrame(rows)
    for c in ("rarity", "set_name", "tcg"):
        df[c] = df[c].astype("category")
    return df


def pinball(y_true: np.ndarray, y_pred: np.ndarray, q: float) -> float:
    d = y_true - y_pred
    return float(np.mean(np.maximum(q * d, (q - 1) * d)))


def evaluate(model: PooledForecaster, X, y) -> dict:
    from .features import as_model_frame

    Xm = as_model_frame(X)
    metrics = {}
    lo = model.models["lower"].predict(Xm)
    mid = model.models["mid"].predict(Xm)
    hi = model.models["upper"].predict(Xm)
    metrics["mae_p50"] = float(np.mean(np.abs(y - mid)))
    metrics["pinball_p10"] = pinball(y.to_numpy(), lo, QUANTILES["lower"])
    metrics["pinball_p90"] = pinball(y.to_numpy(), hi, QUANTILES["upper"])
    metrics["coverage_80"] = float(np.mean((y.to_numpy() >= lo) & (y.to_numpy() <= hi)))
    return metrics


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", type=int, nargs="?", const=200, default=None,
                    help="train on N synthetic cards instead of the DB")
    ap.add_argument("--test-frac", type=float, default=0.2)
    args = ap.parse_args()

    if args.synthetic is not None:
        print(f"Generating synthetic panel ({args.synthetic} cards)…")
        panel = synthetic_panel(args.synthetic)
    else:
        from .db import load_panel

        print("Loading panel from database…")
        panel = load_panel()

    print(f"Panel: {len(panel):,} rows / {panel['card_id'].nunique()} cards")
    frame = build_training_frame(panel)
    if frame.empty or len(frame) < 50:
        print(
            f"Not enough training rows ({len(frame)}). The pooled model needs more "
            "price history — run the backfill first.",
            file=sys.stderr,
        )
        return 2

    frame = frame.sample(frac=1.0, random_state=0).reset_index(drop=True)
    y = frame["y"]
    X = frame.drop(columns=["y"])
    cut = int(len(frame) * (1 - args.test_frac))
    Xtr, Xte, ytr, yte = X.iloc[:cut], X.iloc[cut:], y.iloc[:cut], y.iloc[cut:]

    print(f"Training pooled quantile model on {len(Xtr):,} rows…")
    model = PooledForecaster(
        trained_at=datetime.utcnow().isoformat() + "Z",
        n_train_rows=len(Xtr),
    ).fit(Xtr, ytr)

    model.metrics = evaluate(model, Xte, yte)
    print("Holdout metrics:")
    for k, v in model.metrics.items():
        print(f"  {k:14s} {v:.4f}")

    model.save()
    print(f"Saved model → version={model.version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
