# Invoice Tracker

A full-stack web application for tracking invoice checkouts — issue invoices to field executives, record returns, manage backdate approvals, and export reports. Built for small teams (5–20 users) with role-based access control.

**Live:** <https://infobells-invoice-tracker.vercel.app>

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (User)                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Vercel (Frontend)                               │
│                                                                 │
│   React 18 + TypeScript + Vite + Tailwind CSS                   │
│   React Router (client-side routing)                            │
│   Axios (JWT Bearer token on every request)                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS REST API
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│               Railway (Backend — Docker Container)              │
│                                                                 │
│   Node.js + Express + TypeScript                                │
│   Prisma ORM · JWT Auth · bcryptjs · zod validation            │
│                                                                 │
│   Routes:                                                       │
│   POST /auth/login          GET  /checkouts/outstanding         │
│   POST /checkouts/issue     GET  /invoices/search               │
│   POST /checkouts/return    POST /approvals                     │
│   POST /checkouts/:id/void  GET  /export/history.csv            │
│   GET  /users               GET  /export/outstanding.csv        │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Internal Railway network
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│               Railway (PostgreSQL Database)                     │
│                                                                 │
│   users · executives · routes · checkouts · approval_requests  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

### Invoice Lifecycle

- **Issue** — assign one or multiple invoices to an executive on a specific route
- **Return** — mark invoices as returned in batch
- **Void** — cancel a checkout with a recorded reason
- **History** — full audit trail per invoice number across all time

### Role-Based Access Control

| Feature | ADMIN | OFFICE\_STAFF | EXECUTIVE |
| --- | --- | --- | --- |
| Issue / Return invoices | ✅ | ✅ | ❌ |
| Void checkouts | ✅ | ❌ | ❌ |
| Override issue/return datetime | ✅ | ❌ | ❌ |
| Request backdate approval | ✅ | ✅ | ❌ |
| Approve / Reject requests | ✅ | ❌ | ❌ |
| View all outstanding invoices | ✅ | ✅ | ❌ |
| View own outstanding invoices | ✅ | ✅ | ✅ |
| Export CSV reports | ✅ | ✅ | Own data only |
| Manage users / executives / routes | ✅ | ❌ | ❌ |

### Backdate Approval Workflow

Office staff can only issue/return invoices with the current timestamp. If a past datetime is needed, they submit a backdate request that an admin reviews and approves. A 5-minute tolerance window is built in for minor timing differences.

### Batch Operations

Issue or return multiple invoice numbers in a single submission. Results are returned per-invoice so partial failures are clearly identified.

### Reporting & Export

- Outstanding invoices with days-out calculation (highlighted red at ≥7 days)
- Full history search by invoice number, executive, route, date range, and status
- One-click CSV export with all active filters applied

---

## Data Model

```text
executives
  id, name, is_active

users
  id, name, username, password_hash
  role: ADMIN | OFFICE_STAFF | EXECUTIVE
  is_active, executive_id → executives

routes
  id, route_number, description, is_active

checkouts
  id, invoice_number
  executive_id → executives
  route_id     → routes
  out_datetime, out_by_user_id → users
  in_datetime,  in_by_user_id  → users   (null = outstanding)
  voided, void_reason, voided_by_user_id, voided_at
  ── unique constraint: one active checkout per invoice_number
     (where in_datetime IS NULL and voided = false)

approval_requests
  id, request_type: CHECKOUT_BACKDATE | RETURN_BACKDATE
  status: PENDING | APPROVED | REJECTED
  requested_by_user_id → users
  reviewed_by_user_id  → users
  review_reason, payload (JSON), requested_at, reviewed_at
```

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router v6, Axios |
| Backend | Node.js, Express, TypeScript, Prisma ORM, JWT, bcryptjs, zod |
| Database | PostgreSQL |
| Frontend hosting | Vercel |
| Backend hosting | Railway (Docker) |

---

## Local Development

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL) or a local Postgres instance

### Backend

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET in .env

npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Set VITE_API_URL=http://localhost:3000

npm install
npm run dev
```

---

## Deploying Your Own Instance

This app is single-tenant (one company per deployment). To use it for a different organisation, deploy your own copy:

### 1. Backend — Railway

1. Create a new Railway project
2. Add a **PostgreSQL** service
3. Add a new service from this GitHub repo (set root directory to `backend`)
4. Set environment variables:

   ```text
   DATABASE_URL   = <from Railway Postgres>
   JWT_SECRET     = <random string, min 32 characters>
   CORS_ORIGIN    = https://<your-vercel-domain>.vercel.app
   NODE_ENV       = production
   PORT           = 3000
   ```

5. Railway will build and run the Docker container automatically

### 2. Frontend — Vercel

1. Import this repo into Vercel (set root directory to `frontend`)
2. Add environment variable:

   ```text
   VITE_API_URL = https://<your-railway-backend-url>
   ```

3. Deploy

---

## Environment Variables

### Backend

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for signing JWTs (min 32 chars) |
| `CORS_ORIGIN` | ✅ | Frontend URL (e.g. `https://myapp.vercel.app`) |
| `NODE_ENV` | ✅ | `production` or `development` |
| `PORT` | — | Defaults to `3000` |
| `JWT_EXPIRES_IN` | — | Defaults to `7d` |
| `BCRYPT_ROUNDS` | — | Defaults to `12` |

### Frontend

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | ✅ | Backend base URL (e.g. `https://myapi.up.railway.app`) |
