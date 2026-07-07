"""Runtime configuration for the forecasting service (env-driven)."""
from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # dotenv is optional in prod
    pass

# The horizons the pooled model is trained to predict (days). `h` is also a
# feature, so any horizon in [1, MAX_HORIZON] is served by interpolation.
TRAIN_HORIZONS = [30, 90, 180]
MAX_HORIZON = 365

# Minimum distinct daily observations a card needs before it contributes
# training rows (below this it can still be *served* via the pooled model).
MIN_HISTORY_POINTS = 8

MODELS_DIR = Path(os.getenv("MODELS_DIR", Path(__file__).resolve().parent.parent / "models"))
MODEL_FILE = MODELS_DIR / "pooled_forecaster.joblib"

# Auth: if set, /forecast requires `Authorization: Bearer <secret>`.
SERVICE_SECRET = os.getenv("ML_FORECAST_SERVICE_SECRET")

# How often (seconds) inference may reuse a card's fetched history before reload.
CACHE_TTL_SECONDS = int(os.getenv("ML_CACHE_TTL_SECONDS", "900"))


def database_url() -> str:
    """Normalise DATABASE_URL / MYSQL_URL to a SQLAlchemy+PyMySQL DSN."""
    raw = os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL")
    if not raw:
        raise RuntimeError("DATABASE_URL (or MYSQL_URL) is required")
    # Prisma-style `mysql://` -> SQLAlchemy `mysql+pymysql://`
    if raw.startswith("mysql://"):
        raw = "mysql+pymysql://" + raw[len("mysql://") :]
    # Strip query params PyMySQL doesn't understand (e.g. ?connection_limit=)
    return raw.split("?", 1)[0]
