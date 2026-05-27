# TimeSync API — FastAPI backend
# Built and run behind Caddy via docker-compose.yml (see repo root).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first for better layer caching.
# All deps (psycopg2-binary, bcrypt, cryptography) ship manylinux wheels,
# so no compiler toolchain is needed.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code. Layout is /app/app/... so that:
#   - `uvicorn app.main:app` resolves (CWD /app is on sys.path), and
#   - service-account.json written at startup (CWD = /app) is found by the
#     services, which resolve it to <dirname^3 of app/services/*> == /app.
COPY . .

# Run unprivileged; /app must be writable so startup can materialize
# service-account.json from GOOGLE_SERVICE_ACCOUNT_CONTENT.
RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# --proxy-headers + trust-all forwarded IPs: only Caddy (on the private
# compose network) can reach this port, so request.url reflects the real
# https scheme/host set by the proxy.
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
