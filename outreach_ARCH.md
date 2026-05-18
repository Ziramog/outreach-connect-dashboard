# Outreach Connect — Architecture Document

> WhatsApp Outreach System · Baileys + Express + Next.js · VPS Contabo 194.163.161.99
> Updated: 2026-05-18

---

## 1. Current Stack

| Layer | Technology | Where it runs | Status |
|---|---|---|---|
| Frontend | Next.js 14 (App Router) | Vercel (`outreach-connect-dashboard.vercel.app`) | Active |
| API Gateway | Express 4 + TypeScript | VPS :3000 (PM2 `wolfim-api`) | Active |
| WhatsApp | Baileys `@whiskeysockets/baileys` v2.3000 | VPS PM2 `outreach-daemon` | Connected |
| Outreach Daemon | Custom JS autonomous loop | VPS PM2 (`outreach-daemon`, PID 2137820) | Running |
| Lead Database | Supabase PostgreSQL | Cloud (`mrrieeeilameejhvbccu.supabase.co`) | Active |
| Session Storage | Baileys multi-file auth | VPS `/home/hermes/data/baileys-connect/` | Active (persistent — no re-scan needed) |

**Repositories:**
- Dashboard/API: `https://github.com/Ziramog/outreach-connect-dashboard` (monorepo at `F:\baileysconnect\`)
- Daemon: `https://github.com/Ziramog/outreach-connect-daemon` (VPS at `/home/hermes/workspace/projects/outreach-connect-daemon/`)

**HTTPS:** All traffic between Vercel and VPS uses HTTPS via `https://api.wolfim.com` (Let's Encrypt). `NEXT_PUBLIC_VPS_API_URL` updated to `https://api.wolfim.com`. `ALLOWED_ORIGIN` locked to `https://outreach-connect-dashboard.vercel.app`.

---

## 2. Infrastructure Map

```
VPS: 194.163.161.99
├── :3000  → wolfim-api (PM2, cluster mode) — Express API (internal only)
├── :443   → Nginx → api.wolfim.com (HTTPS, Let's Encrypt) → Express :3000
└── :4000  → old wolfim API (standalone, not managed) — unused

Data directories:
├── /home/hermes/data/baileys-connect/   ← WhatsApp auth session + status + QR
├── /data/auth-session/                  ← older session backup (device 2)
└── /home/hermes/data/                   ← leads CSV exports, old SQLite dbs

Daemon (PM2-managed):
└── outreach-daemon (PM2, PID 2137820): node /home/hermes/workspace/projects/outreach-connect-daemon/daemon.js
```

---

## 3. Repository Structure

```
F:\baileysconnect\                    ← local monorepo root
├── apps/
│   ├── api/                          ← Express API (TypeScript)
│   │   ├── src/
│   │   │   ├── index.ts               ← entry point
│   │   │   ├── config.ts              ← env config
│   │   │   ├── middleware/auth.ts     ← API_SECRET validation
│   │   │   ├── routes/
│   │   │   │   ├── qr.ts              ← QR status/image/start/disconnect/regenerate
│   │   │   │   ├── daemon.ts           ← daemon start/stop/restart/logs
│   │   │   │   ├── leads.ts           ← leads CRUD + actions
│   │   │   │   ├── stats.ts           ← stats from Supabase
│   │   │   │   ├── settings.ts         ← settings read/write
│   │   │   │   └── health.ts
│   │   │   └── services/
│   │   │       ├── baileys.service.ts ← WA state via file-based IPC
│   │   │       ├── daemon.service.ts  ← PM2 programmatic control
│   │   │       └── db.service.ts     ← Supabase wrapper (with pagination fix)
│   │   ├── ecosystem.config.js        ← PM2 config
│   │   └── dist/                      ← compiled output (deployed to VPS)
│   └── web/                           ← Next.js frontend
│       ├── app/
│       │   ├── page.tsx               → /  Dashboard home
│       │   ├── connect/page.tsx        → /connect  WhatsApp QR
│       │   ├── leads/page.tsx         → /leads  leads table + filters
│       │   ├── leads/[id]/page.tsx    → /leads/[id]  lead detail
│       │   ├── stats/page.tsx         → /stats  stats page
│       │   └── settings/page.tsx      → /settings
│       ├── components/
│       │   ├── QRDisplay.tsx          ← WhatsApp QR UI
│       │   ├── DaemonControl.tsx      ← daemon start/stop/restart
│       │   ├── StatusBadge.tsx
│       │   ├── Sidebar.tsx
│       │   ├── LeadCard.tsx
│       │   ├── StatsCard.tsx
│       │   └── LogTerminal.tsx
│       ├── contexts/WhatsAppContext.tsx ← polls QR status every 3s
│       └── app/api/proxy/[...path]/   ← proxy to VPS API (injects secret)

/home/hermes/workspace/projects/outreach-connect-daemon/  (VPS, not in monorepo)
├── daemon.js            ← main loop + anti-ban + business hours
├── baileys-relay.js     ← WhatsApp connection (Baileys)
├── outreach.js         ← message templates + classifyReply
├── state.js            ← JSON state persistence
├── leads.js           ← lead import/management
├── notifier.js        ← notifications + QR capture
└── ecosystem.config.js ← PM2 config for daemon

VPS (not in any repo)
├── /home/hermes/data/baileys-connect/
│   ├── creds.json           ← WhatsApp auth credentials
│   ├── qr.txt               ← current QR PNG image
│   ├── status.json          ← connection state
│   ├── warmup.json          ← warm-up config (written by Settings API)
│   └── device-list-*.json   ← device pairing data
└── /data/auth-session/      ← older session backup
```

---

## 4. How the Parts Connect

```
┌─────────────────────────┐   HTTPS (TLS)   ┌─────────────────────────────┐
│  Vercel Frontend         │ ────────────────→  Nginx :443 (api.wolfim.com) │
│  outreach-connect-       │   api.wolfim.com    │   Let's Encrypt cert        │
│  dashboard.vercel.app    │   encrypted          │   → proxy_pass → :3000      │
└─────────────────────────┘                  └──────────────┬───────────────┘
                                                              │
                    ┌─────────────────────────────────────────┤
                    │                                         ↓
        ┌───────────▼───────────┐              ┌──────────────────────────────┐
        │  Daemon (PM2)        │              │   VPS filesystem              │
        │  outreach-daemon     │              │   /home/hermes/data/          │
        │  PID: 2137820       │ ←───────────  │   baileys-connect/             │
        └─────────────────────┘  file IPC     └──────────────────────────────┘
                    ↑
                    │  direct
                    ↓
        ┌─────────────────────┐
        │  WhatsApp           │
        │  (Baileys v2.3000)   │
        │  Device 14           │
        │  +5491178274322       │
        └─────────────────────┘
```

**Communication patterns:**

1. **API → Daemon**: File-based via `control.json` (`{ action: 'reconnect' | 'disconnect' }`)
2. **API → WhatsApp send**: File-based via `send-trigger.json` (daemon watches this file)
3. **Daemon → WhatsApp**: Direct via Baileys `makeWASocket()`
4. **API → Supabase**: Direct via `@supabase/supabase-js` (no file in between)
5. **Dashboard → API**: Vercel proxy route `/api/proxy/[...path]` → `https://api.wolfim.com` (HTTPS)

---

## 5. Anti-Ban Strategy (Active)

| Protection | Value | Source | Log |
|---|---|---|---|
| **Warm-up schedule** | Configurable via Settings (`warmup.json`) | Settings API → `warmup.json` | `[WarmUp] 3/7d - limit: 12/day` |
| Daily limit (default) | 20 messages/day | Fallback from offline ramp-up | `[Cap] DAILY LIMIT REACHED` |
| Variable delay | 15-45s random between messages | daemon.js | `[Delay] 23.4s` |
| Ramp-up (fresh start) | 5 msgs/day | Automatic (when warmup disabled) | `[RampUp] Fresh start — 5 msgs/day` |
| Ramp-up (>72h offline) | 5 msgs/day | Automatic | `[RampUp] Offline>72h — 5/day` |
| Ramp-up (24-72h offline) | 10 msgs/day | Automatic | `[RampUp] Offline>24h — 10/day` |
| Normal | 20 msgs/day | Automatic | `[RampUp] Normal — 20/day` |
| Business hours | 8 AM - 5 PM Argentina (UTC-3) | daemon.js | `[Business Hours] Outside schedule` |
| Weekends | No sending | daemon.js | `[Business Hours] ... Weekend` |

**Warm-up system:** When `warmup.enabled: true` in Settings, the daemon reads `warmup.json` and uses linear interpolation from `start_limit` → `daily_limit` over `duration_days`. Example: 5 msgs/day for 3 days, then ramp to 20/day. Resets counter at midnight. File: `/home/hermes/data/baileys-connect/warmup.json`.

---

## 6. API Endpoints

**Base URL:** `http://194.163.161.99:3000` (VPS) — proxied via Vercel at `https://outreach-connect-dashboard.vercel.app/api/proxy/`

**Auth:** All endpoints require header `x-api-secret: 30038fa230438403eeb24caa3c2670d1f62eeb36fcc80f82f7da4eca6b2c9d45`

### QR

| Method | Path | Description |
|---|---|---|
| GET | `/api/qr/status` | `{ status, phone?, qr_available }` |
| GET | `/api/qr/image` | PNG image (200 or 404) |
| POST | `/api/qr/start` | Returns error (daemon must be running) |
| POST | `/api/qr/disconnect` | Writes `{ action: 'disconnect' }` to control.json |
| POST | `/api/qr/regenerate` | Writes `{ action: 'reconnect' }` to control.json |

### Daemon

| Method | Path | Description |
|---|---|---|
| GET | `/api/daemon/status` | `{ running, pid?, uptime?, leads_processed_today }` |
| POST | `/api/daemon/start` | Launch via PM2 |
| POST | `/api/daemon/stop` | Stop via PM2 |
| POST | `/api/daemon/restart` | Restart via PM2 |
| GET | `/api/daemon/logs?lines=50` | `{ logs: string[], timestamp }` |

### Leads

| Method | Path | Description |
|---|---|---|
| GET | `/api/leads?status=&city=&vertical=&page=&limit=` | `{ leads, total, page }` |
| GET | `/api/leads/cities` | `{ cities: string[] }` |
| GET | `/api/leads/verticals` | `{ verticals: { vertical, count }[] }` |
| GET | `/api/leads/:id` | Single lead |
| POST | `/api/leads/:id/action` | send_intro, send_followup, mark_hot, discard, reset |
| POST | `/api/leads/import` | Bulk import `{ imported, skipped }` |

### Stats & Settings

| Method | Path | Description |
|---|---|---|
| GET | `/api/stats` | Full stats with pagination (by_city, by_status, by_vertical) |
| GET | `/api/settings` | Current settings |
| PUT | `/api/settings` | Update settings |

---

## 7. Supabase Schema

**Table: `leads`**

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| vertical | text | 17 distinct values across 1569 leads |
| nombre | text | business name |
| telefono | text | primary phone |
| whatsapp | text | nullable |
| email | text | nullable |
| ciudad | text | 55 distinct cities |
| provincia | text | |
| fuente | text | google_maps, serper, research... |
| scraped_at | timestamptz | |
| outreach_status | text | pending, outreach_sent, replied, qualified, rejected... |
| outreach_sent_at | timestamptz | nullable |
| outreach_response | text | nullable |
| actions_history | jsonb | [] |

**Key query fix (2026-05-17):** Supabase enforces 1000-row limits. The API uses pagination loops of 1000 rows per page to collect all data for stats/verticals/cities counts.

---

## 8. Environment Variables

### VPS (`/home/hermes/workspace/wolfim-api/.env`)
```
NODE_ENV=production
PORT=3000
API_SECRET=30038fa230438403eeb24caa3c2670d1f62eeb36fcc80f82f7da4eca6b2c9d45
AUTH_SESSION_PATH=/data/auth-session
DB_PATH=/data/wolfim.db
DAEMON_SCRIPT=/home/hermes/workspace/projects/outreach-connect-daemon/daemon.js
ALLOWED_ORIGIN=https://outreach-connect-dashboard.vercel.app
SUPABASE_URL=https://mrrieeeilameejhvbccu.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc... (service role key)
```

### Daemon env (PM2 `outreach-daemon`)
```
NODE_ENV=production
TZ=America/Argentina/Cordoba
HTTP_PROXY=http://022dd721a029802f73a4:221e4f35e3534717@gw.dataimpulse.com:823
HTTPS_PROXY=http://022dd721a029802f73a4:221e4f35e3534717@gw.dataimpulse.com:823
```

### Vercel
```
NEXT_PUBLIC_VPS_API_URL=https://api.wolfim.com
API_SECRET=30038fa230438403eeb24caa3c2670d1f62eeb36fcc80f82f7da4eca6b2c9d45
```

---

## 9. Quick Commands

```bash
# === VPS ===
pm2 status                        # Check PM2 processes (wolfim-api + outreach-daemon)
pm2 restart wolfim-api            # Restart API
pm2 restart outreach-daemon       # Restart daemon
pm2 logs wolfim-api --lines 50   # View API logs
pm2 logs outreach-daemon --lines 50  # View daemon logs

# === Testing ===
curl https://api.wolfim.com/health
curl -H "x-api-secret: 30038fa230438403eeb24caa3c2670d1f62eeb36fcc80f82f7da4eca6b2c9d45" https://api.wolfim.com/api/qr/status
curl -H "x-api-secret: 30038fa230438403eeb24caa3c2670d1f62eeb36fcc80f82f7da4eca6b2c9d45" https://api.wolfim.com/api/stats
```

---

## 10. Areas for Improvement

### Completed ✅
- **Daemon PM2-managed** — `outreach-daemon` now runs via PM2 with `autorestart: true`, survives reboots
- **Send mechanism fixed** — `sendMessage()` writes to `send-trigger.json`, `POST /api/qr/send` endpoint added
- **HTTPS from Vercel** — `NEXT_PUBLIC_VPS_API_URL=https://api.wolfim.com`, Let's Encrypt cert active, `ALLOWED_ORIGIN` locked
- **Warm-up system** — configurable warm-up in Settings (enabled, start_limit, duration_days), writes to `warmup.json` for daemon to read
- **Target filters** — Settings page has target_verticals and target_provincias dropdowns to filter which leads to include in outreach
- **Persistent WhatsApp session** — `useMultiFileAuthState` stores credentials at `/home/hermes/data/baileys-connect/`, auto-reconnects on daemon restart without re-scanning QR
- **Stats fixed** — `sent_today`/`sent_week` now use date filters on `outreach_sent_at`, `response_rate` and `conversion_rate` use separate formulas
- **outreach_history schema aligned** — API code now uses actual Supabase columns: `status` (not `direction`), `changed_at` (not `sent_at`), `ycloud_message_id` (not `message_id`). No `content` column — activity shown as timeline in UI

### High Priority

**1. QR/image endpoint uses stale qr.txt**
`/api/qr/image` reads from `qr.txt` which persists after QR scan. Should verify freshness (e.g., compare timestamp to status.json `updated_at`).

**2. No health check for WhatsApp connection in API**
`/api/qr/status` reads from file, but there's no verification that the WhatsApp connection is actually live. If the daemon crashes or loses connection, the status.json may show `connected` falsely.

**3. No alerting/monitoring**
- No uptime monitoring (e.g., PM2 + Cronitor, Better Stack)
- WhatsApp disconnect during the night = no outreach until manually noticed
- No Slack/email alerts on session drop

### Low Priority / Future

**4. Typing simulation**
Simulate typing before sending (~30ms per character) to mimic human behavior. From `baileys-antiban`.

**5. Message content variator**
Avoid identical message detection by slightly varying message text (swap synonyms, shuffle order).

**6. Session health monitoring**
Detect Bad MAC errors and decrypt failure ratios before bans happen. From `baileys-antiban`.

**7. ReplyRatioGuard**
Don't send to contacts with <10% reply rate. From `baileys-antiban`.

---

*Architecture as of 2026-05-17 · Wolfim Outreach Connect · Supabase + Baileys + Express + Next.js*