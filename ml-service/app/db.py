"""Database access — reads the same MySQL the Next app writes to."""
from __future__ import annotations

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from .config import database_url

_engine: Engine | None = None


def engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(database_url(), pool_pre_ping=True, pool_recycle=1800)
    return _engine


# One row per (card, day): median market price across conditions, summed volume.
# Aggregating by day removes intra-day / per-condition noise the model doesn't need.
_PANEL_SQL = """
    SELECT
        ph.card_id                         AS card_id,
        DATE(ph.recorded_at)               AS day,
        AVG(ph.price)                      AS price,
        SUM(COALESCE(ph.volume, 0))        AS volume,
        c.rarity                           AS rarity,
        c.set_name                         AS set_name,
        c.tcg                              AS tcg
    FROM price_history ph
    JOIN cards c ON c.id = ph.card_id
    WHERE ph.price > 0
    GROUP BY ph.card_id, DATE(ph.recorded_at), c.rarity, c.set_name, c.tcg
    ORDER BY ph.card_id, day
"""

_CARD_SQL = """
    SELECT
        ph.card_id                  AS card_id,
        DATE(ph.recorded_at)        AS day,
        AVG(ph.price)               AS price,
        SUM(COALESCE(ph.volume, 0)) AS volume,
        c.rarity                    AS rarity,
        c.set_name                  AS set_name,
        c.tcg                       AS tcg
    FROM price_history ph
    JOIN cards c ON c.id = ph.card_id
    WHERE ph.card_id = :card_id AND ph.price > 0
    GROUP BY ph.card_id, DATE(ph.recorded_at), c.rarity, c.set_name, c.tcg
    ORDER BY day
"""


def load_panel() -> pd.DataFrame:
    """Full cross-sectional panel for training."""
    df = pd.read_sql(text(_PANEL_SQL), engine())
    return _coerce(df)


def load_card(card_id: int) -> pd.DataFrame:
    """A single card's daily series for inference."""
    df = pd.read_sql(text(_CARD_SQL), engine(), params={"card_id": card_id})
    return _coerce(df)


def _coerce(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    df["day"] = pd.to_datetime(df["day"])
    df["price"] = df["price"].astype(float)
    df["volume"] = df["volume"].astype(float)
    for c in ("rarity", "set_name", "tcg"):
        df[c] = df[c].astype("category")
    return df
