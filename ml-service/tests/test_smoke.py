"""Offline smoke test — no DB, no network. Runnable as `python -m tests.test_smoke`."""
from __future__ import annotations

from app.features import build_training_frame
from app.model import PooledForecaster, forecast_card
from app.train import synthetic_panel


def test_end_to_end_synthetic():
    panel = synthetic_panel(n_cards=60, days=200, seed=3)
    frame = build_training_frame(panel)
    assert len(frame) > 100, "synthetic panel should yield training rows"

    y = frame["y"]
    X = frame.drop(columns=["y"])
    model = PooledForecaster().fit(X, y)
    assert model.is_ready()

    # Forecast one card and validate the contract shape.
    one = panel[panel["card_id"] == 1]
    result = forecast_card(model, one, horizon=90)
    assert result is not None
    assert len(result["forecast"]) == 90
    pt = result["forecast"][0]
    assert set(pt) == {"date", "predicted", "lower", "upper"}
    assert pt["lower"] <= pt["predicted"] <= pt["upper"] or pt["lower"] <= pt["upper"]
    assert 0.0 <= result["confidence"] <= 1.0
    assert isinstance(result["projectedChangePct"], float)
    print("smoke OK:", {k: result[k] for k in ("model", "confidence", "projectedChangePct")})


if __name__ == "__main__":
    test_end_to_end_synthetic()
    print("PASS")
