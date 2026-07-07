"""FastAPI forecasting service.

Serves the SAME contract as the Next.js statistical baseline, so
`/api/forecast` can prefer this service and fall back transparently.

    POST /forecast   { "card_id": 1, "days": 90 }  ->  forecast contract
    GET  /health
"""
from __future__ import annotations

import time

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .config import MAX_HORIZON, MODEL_FILE, SERVICE_SECRET
from .db import load_card
from .model import PooledForecaster, forecast_card

app = FastAPI(title="foil-alpha forecasting", version="1.0")

_model: PooledForecaster | None = None
_model_error: str | None = None


def _load_model() -> None:
    global _model, _model_error
    try:
        _model = PooledForecaster.load(MODEL_FILE)
        _model_error = None
    except Exception as e:  # no artifact yet -> service reports not-ready
        _model = None
        _model_error = str(e)


@app.on_event("startup")
def startup() -> None:
    _load_model()


def require_secret(authorization: str | None = Header(default=None)) -> None:
    if not SERVICE_SECRET:
        return  # auth disabled
    if authorization != f"Bearer {SERVICE_SECRET}":
        raise HTTPException(status_code=401, detail="unauthorized")


class ForecastRequest(BaseModel):
    card_id: int = Field(..., ge=1)
    days: int = Field(90, ge=1, le=MAX_HORIZON)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model_ready": _model is not None and _model.is_ready(),
        "model_version": _model.version if _model else None,
        "model_error": _model_error,
    }


@app.post("/reload")
def reload_model(_: None = Depends(require_secret)) -> dict:
    _load_model()
    return health()


@app.post("/forecast")
def forecast(req: ForecastRequest, _: None = Depends(require_secret)) -> dict:
    if _model is None or not _model.is_ready():
        # Not trained yet — signal the caller to use its baseline.
        raise HTTPException(status_code=503, detail="model not ready")

    t0 = time.time()
    card_df = load_card(req.card_id)
    if card_df.empty:
        raise HTTPException(status_code=404, detail="no history for card")

    result = forecast_card(_model, card_df, req.days)
    if result is None:
        raise HTTPException(status_code=422, detail="insufficient history to forecast")

    result["card_id"] = req.card_id
    result["horizon_days"] = req.days
    result["latency_ms"] = round((time.time() - t0) * 1000, 1)
    return result
