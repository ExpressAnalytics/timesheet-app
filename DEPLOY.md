# Backend Deployment (Docker Compose + Caddy)

The TimeSync **API** runs as a two-container stack: the FastAPI app (uvicorn)
behind [Caddy](https://caddyserver.com), which terminates HTTPS and
auto-provisions/renews a Let's Encrypt certificate. The **frontend** is hosted
separately on Vercel and is not part of this stack.

```
Internet ──443 (HTTPS)──▶ caddy ──8000 (HTTP, private net)──▶ backend (uvicorn)
```

- API domain: `timesyncapi.expressanalytics.com`
- ACME contact: `ajmal.aksar@expressanalytics.net` (Caddy registers one email; `kiran@expressanalytics.net` is noted as secondary in the `Caddyfile`)

## Prerequisites

1. A host with Docker Engine + the Compose plugin installed.
2. **DNS**: an `A` record for `timesyncapi.expressanalytics.com` → this host's public IP. (Add `AAAA` too if the host has IPv6.)
3. **Ports** `80` and `443` (TCP, plus `443/udp` for HTTP/3) open to the internet. Caddy needs `:80`/`:443` reachable to complete the ACME challenge.

## First deploy

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set a real SECRET_KEY and verify all credentials.
# For Google service-account features, set GOOGLE_SERVICE_ACCOUNT_CONTENT
# to the JSON contents (it's written to disk on startup).

docker compose up -d --build
```

Watch certificate issuance and app startup:

```bash
docker compose logs -f caddy backend
```

Once the cert is issued, verify:

```bash
curl https://timesyncapi.expressanalytics.com/health
```

## Operating

| Task | Command |
|------|---------|
| Update after code/config change | `docker compose up -d --build` |
| Tail logs | `docker compose logs -f backend` / `... caddy` |
| Restart a service | `docker compose restart backend` |
| Stop the stack | `docker compose down` |
| Reload Caddyfile without downtime | `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile` |

Issued certificates and the ACME account live in the `caddy_data` volume, so
they survive restarts — don't delete that volume or Caddy will re-request certs
(and may hit Let's Encrypt rate limits).

## Notes

- **Frontend (Vercel):** point the frontend's API base URL at
  `https://timesyncapi.expressanalytics.com`. The backend's CORS allow-list
  (in `backend/app/main.py`) and `FRONTEND_URL` must include the Vercel origin —
  that's already the browser origin, so no new entry is needed for the API
  domain itself.
- **Local testing without a real cert:** point the site block in `Caddyfile`
  at `localhost` (Caddy issues a local CA cert), or run uvicorn directly per
  `QUICK_START.md`.
- The backend port is internal to the compose network only. Uncomment the
  `ports:` block under `backend` in `docker-compose.yml` to expose it on
  `127.0.0.1:8000` for debugging.
