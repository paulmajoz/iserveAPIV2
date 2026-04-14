# iServe API V2

Unified NestJS backend for iServe — Attendance & Community Service Tracking.

- **Port:** 3001 (dev) / 3001 (Docker)
- **Database:** MongoDB — reuses existing `iserveza` database
- **Swagger docs:** `http://localhost:3001/api/docs`

---

## Prerequisites

- Node.js 20+
- Access to the MongoDB instance (credentials in `.env.dev`)

---

## Environment Setup

Copy the example env and fill in your values (already done if you copied from `iserveAPI`):

```bash
# Development env is pre-configured — just verify the values
cat .env.dev
```

Key variables:

| Variable | Description |
|---|---|
| `PORT` | API port (default `3001`) |
| `MONGO_URI` | MongoDB connection string |
| `PUBLIC_UI_BASE_URL` | Base URL of iserveUIV2 — used to generate QR code URLs |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email credentials for sending event emails |

---

## Running Locally (Development)

```bash
# 1. Install dependencies
npm install

# 2. Start in watch mode (auto-restarts on file changes)
npm run start:dev
```

The API will be available at `http://localhost:3001/api`.
Swagger UI will be available at `http://localhost:3001/api/docs`.

---

## Other npm Scripts

```bash
# Start without watch mode
npm run start

# Build for production
npm run build

# Start compiled production build
npm run start:prod
```

---

## Running with Docker (Production)

From the **project root** (`iServeZA/`):

```bash
# Build and start only the V2 services
docker-compose up --build iserveAPIV2

# Or start all services (including legacy)
docker-compose up --build
```

To run in the background:

```bash
docker-compose up -d --build iserveAPIV2
```

---

## API Modules

| Module | Route prefix | Description |
|---|---|---|
| Schools | `/api/schools` | School CRUD, theme colours, grade targets |
| Event Types | `/api/event-types` | Lookup table (scoped per school) |
| Event Categories | `/api/event-categories` | Lookup table (scoped per school) |
| Events | `/api/events` | Unified event CRUD + QR generation + email |
| Attendance | `/api/attendance` | Student self-scan, teacher-assisted scan, summaries |

### Key endpoints

```
POST   /api/events                          Create event (auto-generates QR codes, sends email)
GET    /api/events/by-person?email=&schoolId=&role=   Teacher's events
GET    /api/events/:id/qr-pdf?direction=in|out        Download QR PDF
POST   /api/events/:id/send-email           Re-send event email

POST   /api/attendance/submit               Student self-scan (in or out)
POST   /api/attendance/scan                 Teacher-assisted scan
GET    /api/attendance/event/:eventId       All attendance for an event
GET    /api/attendance/summary/:email?schoolId=   Student dashboard summary

GET    /api/schools/id/:schoolId/theme      School theme colours (used by UI on load)
```

---

## QR Code URL Format

QR codes generated on event creation point to the UI:

```
{PUBLIC_UI_BASE_URL}/submit/{eventId}?direction=in
{PUBLIC_UI_BASE_URL}/submit/{eventId}?direction=out  (in-out mode only)
```

Make sure `PUBLIC_UI_BASE_URL` in your `.env` matches the deployed UI URL.
