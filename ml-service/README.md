# foil-alpha forecasting service (Phase 2b)

A small FastAPI service that serves ML price forecasts for foil-alpha. It speaks
the **same contract** as the in-app statistical baseline (`src/app/lib/forecast.ts`),
so the Next.js `/api/forecast` route prefers this service and falls back to the
baseline whenever it's unset, unreachable, slow, or unconfident — there is no
frontend change and no regression risk.

## Model

One **pooled** gradient-boosted model across *all* cards (not one model per card),
because per-card history is thin. Three LightGBM quantile regressors (p10/p50/p90)
predict the cumulative log-return at the requested horizon from cross-sectional
features:

- price level, trailing returns (7/30/90d), 30d volatility
- volume level (7/30d) and trend
- card maturity + history span
- `rarity`, `set_name`, `tcg` (native categoricals)
- `horizon` (so one model serves 30/90/180d and anything in between)

The daily path and confidence band are reconstructed by interpolating the
predicted quantile returns in log-price space.

## Layout

```
app/
  config.py     env + paths
  db.py         reads the same MySQL (price_history + cards) -> daily panel
  features.py   shared feature engineering (training == inference)
  model.py      pooled quantile model + contract-shaped forecast
  train.py      training CLI (+ --synthetic for offline smoke tests)
  main.py       FastAPI: POST /forecast, GET /health, POST /reload
tests/test_smoke.py   end-to-end on synthetic data (no DB)
```

## Run locally

```bash
cd ml-service
pip install -r requirements.txt

# 1. Smoke test with generated data (no DB needed):
python -m app.train --synthetic 200      # trains -> models/pooled_forecaster.joblib
python -m tests.test_smoke               # end-to-end contract check

# 2. Against the real DB:
export DATABASE_URL="mysql://user:pass@host:3306/railway"
python -m app.train                      # trains on live price_history
uvicorn app.main:app --reload            # serve on :8000
curl -s localhost:8000/health
curl -s -X POST localhost:8000/forecast -H 'content-type: application/json' \
  -d '{"card_id":1,"days":90}'
```

If there isn't enough history yet, `app.train` exits with a clear message — run
the backfill (`POST /api/cards/backfill-price-history`) in the Next app first.

## Deploy on Railway

1. New service from this `ml-service/` directory (Dockerfile build).
2. Env: `DATABASE_URL` (the shared MySQL), `ML_FORECAST_SERVICE_SECRET` (optional).
3. Mount a **persistent volume at `/app/models`** so the trained artifact survives
   restarts and is shared with the training job.
4. Add a scheduled command (Railway cron) running `python -m app.train` to retrain
   periodically, then `POST /reload` (or restart) to pick up the new artifact.

## Wire up the Next app

Set on the Next service:

```
ML_FORECAST_SERVICE_URL=https://<this-service>.up.railway.app
ML_FORECAST_SERVICE_SECRET=<same secret>   # optional, must match
```

`/api/forecast` will then return `source: "ml-service"` when the service answers,
and `source: "baseline"` otherwise. Until the model is trained the service returns
`503` and the app quietly uses the baseline.
