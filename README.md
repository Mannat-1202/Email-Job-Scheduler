# ReachInbox - Distributed Email Job Scheduler

A production-grade, distributed cold-email scheduling engine and monitoring dashboard built with TypeScript, Express.js, BullMQ, Redis, PostgreSQL (Prisma), Nodemailer (Ethereal SMTP), Elasticsearch, and Next.js (App Router).

---

## 1. System Architecture

```
                                  +---------------------------------------------+
                                  |              Next.js 15 Dashboard           |
                                  |    (App Router, TanStack Query, Tailwind)   |
                                  +----------------------+----------------------+
                                                         | HTTP / JSON
                                                         v
+--------------------------------------------------------+----------------------+
|                                Express.js API Backend                         |
|   /api/campaigns  |  /api/emails  |  /api/senders  |  /api/slack/*  |  /admin/queues |
+-------------+----------------------+-------------------+----------------------+
              |                      |                   |
              v                      v                   v
     +-----------------+    +-----------------+ +-----------------+
     |   PostgreSQL    |    |      Redis      | |  Elasticsearch  |
     | (Source of      |    | (BullMQ Queue + | | (Full-text      |
     |  Truth, Prisma) |    |  Hourly Counts) | |  Search Mirror) |
     +--------+--------+    +--------+--------+ +-----------------+
              ^                      |
              |                      v
              |             +-----------------+
              +-------------+  BullMQ Worker  |-----> Ethereal SMTP (Nodemailer)
                            | (Claim, Limit,  |
                            |  Reschedule)    |-----> Slack Webhook on Cap
                            +-----------------+
```

### Core Architecture Invariants

- **Zero Cron Architecture**: The system uses neither `node-cron`, `agenda`, nor system crontabs. Scheduling is handled exclusively via BullMQ delayed jobs (`jobId: email-<id>`) backed by Redis.
- **PostgreSQL as Single Source of Truth**: Every email is written to PostgreSQL with status `SCHEDULED` before it is enqueued in BullMQ. Dashboard queries read exclusively from PostgreSQL (and Elasticsearch for search queries).
- **Two-Layer Idempotency**:
  1. Queue layer: BullMQ deterministic job IDs (`email-<emailId>`) prevent the same email from being enqueued twice.
  2. Database layer: Workers execute an atomic conditional update:
     ```sql
     UPDATE emails SET status = 'PROCESSING' WHERE id = $1 AND status = 'SCHEDULED';
     ```
     If zero rows are updated, the job aborts immediately to avoid race conditions.
- **Configurable Worker Concurrency & Rate Limiting**:
  - Parallel execution controlled via `WORKER_CONCURRENCY` (default: 5).
  - Minimum send delay enforced via BullMQ queue limiter: `{ max: 1, duration: MIN_DELAY_MS }` (default: 2000ms).
  - Cross-instance hourly limit enforced via atomic Redis key `rl:<senderId>:<YYYYMMDDHH>`.
  - When hourly threshold is hit, the job is not dropped or failed—it is moved into the start of the next hour window via BullMQ's `moveToDelayed(nextWindowTimestamp, job.token)` with random jitter to prevent thundering herds.
- **Boot-Time Reconciliation (Crash & Restart Resilience)**:
  - On startup, before `app.listen()`, `reconcile()` queries PostgreSQL for all emails in `SCHEDULED` or `PROCESSING` state.
  - Diffed against live BullMQ jobs in Redis. Missing jobs are re-enqueued with their remaining delay. Orphaned `PROCESSING` jobs without active worker locks are reset to `SCHEDULED` and rescheduled.
- **Elasticsearch Search Mirror with Postgres Fallback**:
  - Newly created and status-updated emails are mirrored into Elasticsearch (`emails` index).
  - `GET /api/emails/search?q=` queries Elasticsearch with full-text fuzzy matching, falling back to PostgreSQL if Elasticsearch is unavailable.
- **Bull-Board Live Queue Visualizer**:
  - Live BullMQ monitoring mounted at `/admin/queues` via `@bull-board/express`.

---

## 2. Directory Structure

```
.
├── docker-compose.yml           # PostgreSQL, Redis (AOF), Elasticsearch
├── .env.example                 # Environment configuration template
├── package.json                 # Monorepo root workspace orchestrator
├── backend/
│   ├── src/
│   │   ├── admin/               # Bull-Board Express dashboard
│   │   ├── config/              # Zod environment validation
│   │   ├── db/                  # Prisma schema and client
│   │   ├── middleware/          # Auth, error handling, CSV upload
│   │   ├── queues/              # BullMQ queue and worker implementations
│   │   ├── routes/              # Express API route handlers
│   │   ├── services/            # Rate limiting, mailer, search, slack, reconciliation
│   │   ├── app.ts               # Express configuration
│   │   └── server.ts            # Server bootloader with reconciliation
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── app/                     # Next.js 15 App Router pages & API routes
│   ├── components/              # UI kit and table components
│   ├── hooks/                   # TanStack Query polling hooks
│   ├── lib/                     # Typed API client
│   ├── types/                   # Shared TypeScript models
│   ├── package.json
│   └── tailwind.config.js
└── scripts/
    ├── burst-test.ts            # Automated rate limit reschedule test
    ├── restart-test.ts          # Automated server restart & reconciliation test
    └── no-cron-audit.js         # Dependency compliance check
```

---

## 3. Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker and Docker Compose

### 1. Infrastructure Services

Launch PostgreSQL, Redis (with Append-Only File persistence), and Elasticsearch via Docker Compose:

```bash
docker compose up -d
```

Verify all three containers are healthy:
```bash
docker compose ps
```

### 2. Install Dependencies

Install root, backend, and frontend dependencies:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 3. Database Migration

Generate the Prisma client and apply database migrations:

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:push
```

### 4. Running the Application

In terminal 1 (Backend API & BullMQ Worker):
```bash
npm run dev:backend
```
Backend starts on `http://localhost:5000`.
Bull-Board queue visualizer is accessible at `http://localhost:5000/admin/queues`.

In terminal 2 (Frontend Dashboard):
```bash
npm run dev:frontend
```
Frontend starts on `http://localhost:3000`.

---

## 4. Environment Variables

| Variable | Scope | Description | Default |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Backend | PostgreSQL connection string | `postgresql://postgres:postgrespassword@localhost:5432/reachinbox_scheduler?schema=public` |
| `REDIS_URL` | Backend | Redis connection string (BullMQ & rate counters) | `redis://localhost:6379` |
| `ELASTICSEARCH_URL` | Backend | Elasticsearch search endpoint | `http://localhost:9200` |
| `PORT` | Backend | Express HTTP port | `5000` |
| `WORKER_CONCURRENCY` | Backend | Concurrency limit per worker process | `5` |
| `MIN_DELAY_MS` | Backend | Minimum throttle delay between sends | `2000` |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Backend | Per-sender hourly send quota | `50` |
| `NEXT_PUBLIC_API_URL` | Frontend | Target backend API URL | `http://localhost:5000` |
| `GOOGLE_CLIENT_ID` | Frontend | Google OAuth Client ID | Optional (Demo login available) |
| `GOOGLE_CLIENT_SECRET` | Frontend | Google OAuth Client Secret | Optional (Demo login available) |
| `SLACK_CLIENT_ID` | Backend | Slack OAuth v2 App Client ID | Optional |
| `SLACK_CLIENT_SECRET` | Backend | Slack OAuth v2 App Client Secret | Optional |
| `SLACK_REDIRECT_URI` | Backend | Slack OAuth callback URL | `http://localhost:5000/api/slack/oauth/callback` |

---

## 5. API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/me` | Current authenticated user profile |
| `POST` | `/api/senders` | Provision a new Ethereal test sender account |
| `GET` | `/api/senders` | List configured senders |
| `POST` | `/api/campaigns` | Schedule campaign (supports CSV upload or JSON body) |
| `GET` | `/api/emails?status=scheduled` | List pending delayed emails (paginated) |
| `GET` | `/api/emails?status=sent` | List delivered & failed emails (paginated) |
| `GET` | `/api/emails/search?q=` | Full-text search across recipient, subject, and copy |
| `GET` | `/api/slack/install` | Generates Slack OAuth v2 authorization redirect |
| `GET` | `/api/slack/oauth/callback` | Exchanges Slack OAuth token and stores incoming webhook |
| `DELETE` | `/api/slack` | Disconnects Slack integration |
| `GET` | `/admin/queues` | Bull-Board live dashboard |

---

## 6. Verification and Testing

### 1. No-Cron Compliance Audit
Verifies that no cron libraries exist in any `package.json`:
```bash
node scripts/no-cron-audit.js
```

### 2. Rate Limit Reschedule Test
Demonstrates that sending a burst of 50 emails against an hourly quota of 10 results in 10 immediate sends and 40 delayed jobs postponed to the next hour window without dropping any messages:
```bash
npm --prefix backend run test:burst
```

### 3. Restart and Reconciliation Test
Schedules delayed emails, invokes the boot-time `reconcile()` routine, and asserts that no duplicate jobs or duplicate sends occur:
```bash
npm --prefix backend run test:restart
```

---

## 7. Assignment Verification Checklist

- [x] **No cron anywhere**: Verified via `scripts/no-cron-audit.js`. Scheduling is BullMQ delayed-job based.
- [x] **Process restart survival**: Tested via `reconcile()` routine diffing PostgreSQL and BullMQ on boot.
- [x] **Idempotency**: Enforced by deterministic `jobId: email-<id>` and atomic SQL `status = 'PROCESSING'` claims.
- [x] **Worker concurrency from env**: Configurable via `WORKER_CONCURRENCY`.
- [x] **Minimum delay between sends**: Enforced via BullMQ queue limiter `{ max: 1, duration: MIN_DELAY_MS }`.
- [x] **Hourly cap enforced in Redis**: Cross-instance safe atomic counter `rl:<senderId>:<YYYYMMDDHH>`.
- [x] **Non-dropping reschedule**: Calls `moveToDelayed(nextWindowTimestamp, job.token)` on quota breach.
- [x] **Slack OAuth & Webhook**: Real OAuth v2 flow with webhook notifications dispatched on rate limit breach.
- [x] **Elasticsearch search**: Working `@elastic/elasticsearch` indexing with PostgreSQL `ILIKE` fallback.
- [x] **Bull-Board**: Live queue monitor mounted at `/admin/queues`.
- [x] **Google OAuth**: NextAuth Google provider with quick demo evaluation mode.
- [x] **Scheduled and Sent tables**: Loading skeletons, empty states, and 5-second polling synchronization.
