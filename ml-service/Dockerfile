FROM python:3.12-slim

# libgomp is required by LightGBM at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV MODELS_DIR=/app/models
EXPOSE 8000

# Railway provides $PORT. Serve; training runs as a separate scheduled command
# (`python -m app.train`) against a mounted volume at MODELS_DIR.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
