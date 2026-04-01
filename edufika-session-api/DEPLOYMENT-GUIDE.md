# Edufika Session API - VPS Deployment Guide

## Overview
This guide covers deploying the Edufika website, Session API, and MariaDB on one VPS using Docker Compose with a bundled Nginx reverse-proxy container in front of the web and API services.

**Your VPS Details:**
- Hostname: `edufika.techivibes.com`
- Database: MariaDB (user: `edufika`, password: `edufika`, database: `edufika`)

---

## Step 1: Transfer Files to VPS

Upload the `edufika-session-api` folder to your VPS. You can use SCP, SFTP, or Git:

```bash
# Option A: Using Git (recommended)
git clone <your-repo-url> edufika-session-api
cd edufika-session-api

# Option B: Using SCP
scp -r ./edufika-session-api user@edufika.techivibes.com:/home/user/
```

---

## Step 2: Configure Environment Variables

Update `.env` with production values before starting the stack.

```env
HOST=0.0.0.0
PORT=8091
NODE_ENV=production
DB_DIALECT=mysql
DATABASE_URL=mysql://edufika:edufika@mariadb:3306/edufika

JWT_SECRET=<generate-a-strong-random-secret>
WS_AUTH_TOKEN=<generate-a-strong-random-token>
ADMIN_CREATE_KEY=<generate-a-strong-random-key>

DEFAULT_TOKEN_TTL_MINUTES=120
ACCESS_SIGNATURE_TTL_SECONDS=300
HEARTBEAT_OFFLINE_GRACE_SECONDS=30
HEARTBEAT_WATCH_INTERVAL_SECONDS=5
RISK_LOCK_THRESHOLD=12

# Keep false unless TLS is terminated before the nginx container and
# the incoming request carries X-Forwarded-Proto=https.
REQUIRE_HTTPS=false
DEFAULT_WHITELIST=https://edufika.techivibes.com,https://example.org
```

Generate secure secrets with:

```bash
openssl rand -hex 64
```

Run it once for each of `JWT_SECRET`, `WS_AUTH_TOKEN`, and `ADMIN_CREATE_KEY`.

---

## Step 3: Start All Services

The Compose stack now includes:
- `mariadb` for the database
- `app` for the Node.js API
- `website` for the Vite web frontend from `new_design`
- `nginx` as the public reverse proxy
- `phpmyadmin` for DB inspection

```bash
cd edufika-session-api
docker compose up -d --build
docker compose logs -f nginx website app
```

**Public endpoints:**
- Website via Nginx: `http://localhost:8091/`
- API via Nginx: `http://localhost:8091/api/...`
- Legacy API routes remain available at `http://localhost:8091/session/...`, `.../student/...`, `.../admin/...`, `.../exam/...`, `.../quiz/...`, and `/health`
- phpMyAdmin: `http://localhost:18089` by default, configurable via `PHPMYADMIN_HOST_PORT`

The Node app, website, and MariaDB are no longer published directly to the host; they stay internal on the Docker network and Nginx routes traffic to `app:8091` and `website:80`.

---

## Step 4: Verify Deployment

```bash
docker compose ps
curl http://localhost:8091/health
curl http://localhost:8091/
```

Expected response:

```json
{"ok":true,"service":"edufika-session-api","now":"2024-..."}
```

Database migrations run automatically when the app container starts.

---

## Step 5: Domain Routing

If your domain points directly to the VPS and you want to keep things simple, open port `8091` and use:

```text
http://edufika.techivibes.com:8091
```

If you want clean domain URLs without the port, put an edge proxy or firewall rule in front of the stack and forward traffic to `localhost:8091`.

Recommended route layout:
- Website: `/`
- API: `/api`
- Health: `/health`
- WebSocket telemetry: `/ws`

---

## Step 6: Optional TLS

Nginx is already inside Docker and acting as the reverse proxy. For HTTPS you can either:
- mount certificates into the `nginx` container and extend its config, or
- terminate TLS in a separate edge proxy / load balancer and forward to `localhost:8091`

Only set `REQUIRE_HTTPS=true` when the incoming request path to the app ultimately carries `X-Forwarded-Proto=https`.

---

## Step 7: Firewall Configuration

```bash
sudo ufw allow 22
sudo ufw allow 8091
sudo ufw allow 443
sudo ufw enable
```

If you are not using HTTPS yet, port `443` is optional.

---

## Quick Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View reverse proxy + app logs
docker compose logs -f nginx website app

# Rebuild and restart
docker compose up -d --build

# Restart after git pull
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Production Checklist

- [ ] Environment variables updated with secure secrets
- [ ] Database migrations run successfully
- [ ] `curl http://localhost:8091/health` returns `ok: true`
- [ ] `curl http://localhost:8091/` returns the website
- [ ] `nginx` container is healthy
- [ ] Firewall allows the public ingress port you are using
- [ ] Domain points to the VPS IP

---

## Troubleshooting

**Container name conflicts**

If Docker reports that `edufika-mariadb` or another service name is already in use, remove the old container from the previous deploy once, then start the stack again.

```bash
docker rm -f edufika-mariadb edufika-session-api edufika-website edufika-nginx edufika-phpmyadmin
```

This stack now lets Docker generate container names automatically, which avoids collisions on repeated deploys.

**Database connection issues**

```bash
docker compose logs mariadb
docker compose exec app sh -c 'nc -zv mariadb 3306'
```

**Reverse proxy / app / website issues**

```bash
docker compose logs nginx website app
docker compose exec app env
curl -i http://localhost:8091/health
curl -i http://localhost:8091/
```
