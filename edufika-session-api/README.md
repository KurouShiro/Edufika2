# Edufika Session API

Node.js backend implementing an exam session authority with MySQL/MariaDB + WebSocket realtime monitoring.

## Quick Start

1. Install dependencies.

```bash
npm install
```

2. Copy environment template.

```bash
# Windows PowerShell
Copy-Item .env.example .env

# macOS/Linux
cp .env.example .env
```

Ensure `.env` contains:

```env
DB_DIALECT=mysql
DATABASE_URL=mysql://edufika:edufika@localhost:3306/edufika
```

3. Run MariaDB + phpMyAdmin (Docker compose):

```bash
docker compose up -d
```

phpMyAdmin will be available at `http://localhost:8089`.
Use username `root` and password `rootpass`, or app user `edufika` / `edufika`.

4. Run migrations.

```bash
npm run migrate
```

5. Start API in dev mode.

```bash
npm run dev
```

## Phone Debug Start

1. Keep backend running (`npm run dev`) and note LAN URL printed on startup:
   `http://<your-pc-lan-ip>:8088`
2. Run smoke test from PC:

```bash
npm run smoke:phone
```

3. On Android app, open `Developer Access Panel` and set `Server API URL` to:
   `http://<your-pc-lan-ip>:8088`, then tap `Tes Koneksi Backend`.
4. In Admin panel, set `Launch URL` and generate token.
5. Login on student flow with generated token and start exam.

### If LAN is unreachable (recommended fallback)

Use USB debugging tunnel:

```bash
npm run usb:reverse
```

Then set Android app `Server API URL` to:
`http://127.0.0.1:8088`

## Core Endpoints

- `POST /session/create`
- `POST /session/claim`
- `POST /session/heartbeat`
- `POST /session/event`
- `GET /session/whitelist`
- `POST /session/whitelist/add`
- `POST /session/whitelist/verify`
- `POST /session/proctor-pin/set`
- `POST /session/proctor-pin/verify`
- `GET /session/proctor-pin/status`
- `POST /session/finish`
- `POST /admin/revoke`
- `POST /admin/revoke-student`
- `GET /admin/monitor`
- `GET /exam/launch`
- `POST /exam/launch`

`POST /session/create` supports optional:
- `launch_url`
- `token_ttl_minutes` (1..43200)

`POST /session/create` now mints role-scoped tokens per exam session:
- `S-...` for student
- `A-...` for admin/proctor

Each `exam_session_id` keeps one active token per role (`student`, `admin`).

`POST /session/proctor-pin/set` supports optional:
- `student_token` (recommended, pins policy to that student token only)

## WebSocket

Connect to `ws://localhost:8088` for telemetry events (`heartbeat`, `violation`, `session_locked`, etc.).

## Notes

- In production set `REQUIRE_HTTPS=true` and terminate TLS at reverse proxy/load balancer.
- Access signatures rotate every ~5 minutes through heartbeat responses.
- Heartbeat timeout auto-locks sessions after 30 seconds without updates.
- Finished/revoked sessions are archived to `session_cleanup_audit` and auto-purged on timer.
- This backend does not store exam questions. Use third-party hosted forms/pages and enforce access through launch URL + whitelist.
