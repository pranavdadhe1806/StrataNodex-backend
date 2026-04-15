# StrataNodex Backend

## What is StrataNodex?

**StrataNodex** is a CLI-first, cross-platform productivity and task management system built around a tree-based data model. Unlike flat to-do lists, StrataNodex lets you organize work as infinitely nested nodes — think of it as a filesystem for your tasks, where every node can have children, siblings, priorities, deadlines, markdown notes, and canvas coordinates.

The product spans three clients — **CLI**, **Web**, and **Mobile** — all powered by this single backend API. No client ever touches the database directly. The backend is the single source of truth.

### Core Concepts

| Concept | Description |
|---|---|
| **Folders** | Top-level containers for organizing work (e.g. "Work", "Personal") |
| **Lists** | Live inside folders. Each list is a board of tasks (e.g. "Sprint 14", "Grocery") |
| **Nodes** | The fundamental unit — a task. Nodes live inside lists and can nest infinitely via `parentId` |
| **Tags** | Color-coded labels. Can be global (user-wide) or scoped to a specific list |
| **Daily Scores** | Gamification layer — daily productivity scores computed from task completion rates |
| **Subscriptions** | Tiered plans (Free/Pro/Team) with payment gateway integration |

### Data Hierarchy

```
User
 └── Folders
      └── Lists
           └── Nodes (Tasks)
                └── Sub-nodes (infinite nesting, no depth limit)
```

---

## About This Repository

This is the **backend + database** repository for StrataNodex. It exposes a RESTful JSON API that all three clients consume.

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js 5 |
| Language | TypeScript (strict mode) |
| ORM | Prisma 7 (with `@prisma/adapter-pg` driver adapter) |
| Database | PostgreSQL (hosted on [Neon](https://neon.tech)) |
| Auth | JWT (jsonwebtoken) + bcrypt password hashing + OTP system |
| Validation | Zod 4 |
| Background Jobs | BullMQ + Redis (planned) |
| Payments | Razorpay / Stripe (planned) |

---

## Architecture

The backend follows a strict **layered architecture** with clear separation of concerns:

```
Request → Route → Middleware → Controller → Service → Prisma → PostgreSQL
```

### Architecture Rules

1. **Controllers are dumb** — One service call + `res.json()`. Zero business logic.
2. **Services own all logic** — All DB queries, computations, validations, and error throwing.
3. **Never expose `passwordHash`** — Always omit it from any API response.
4. **Always scope to `req.user.id`** — Every DB query must be ownership-scoped.
5. **OTP codes stored hashed** — bcrypt hash before insert. Never store plaintext.
6. **TypeScript strict mode** — No `any` types. `tsc --noEmit` must always pass.

### Directory Structure

```
StrataNodex-backend/
├── prisma/
│   ├── schema.prisma          # Database schema (11 models, 8 enums)
│   └── migrations/            # Auto-generated SQL migrations
├── src/
│   ├── index.ts               # Entry point — starts Express server
│   ├── app.ts                 # Express app setup, middleware, route registration
│   ├── config/
│   │   ├── env.ts             # Environment variable loader & validation
│   │   └── prisma.ts          # PrismaClient singleton (with pg adapter)
│   ├── middleware/
│   │   ├── auth.middleware.ts  # JWT verification → attaches req.user.id
│   │   ├── errorHandler.ts    # Global error handler (catches thrown errors)
│   │   └── validate.ts        # Zod schema validation middleware factory
│   ├── routes/                # Express Router definitions (URL → Controller)
│   │   ├── auth.routes.ts
│   │   ├── otp.routes.ts
│   │   ├── folder.routes.ts
│   │   ├── list.routes.ts
│   │   ├── node.routes.ts
│   │   ├── tag.routes.ts
│   │   ├── daily.routes.ts
│   │   └── score.routes.ts
│   ├── controllers/           # Thin wrappers — call service, return response
│   │   ├── auth.controller.ts
│   │   ├── otp.controller.ts
│   │   ├── folder.controller.ts
│   │   ├── list.controller.ts
│   │   ├── node.controller.ts
│   │   ├── tag.controller.ts
│   │   ├── daily.controller.ts
│   │   └── score.controller.ts
│   ├── services/              # Business logic + database queries
│   │   ├── auth.service.ts
│   │   ├── otp.service.ts
│   │   ├── folder.service.ts
│   │   ├── list.service.ts
│   │   ├── node.service.ts
│   │   ├── tag.service.ts
│   │   ├── daily.service.ts
│   │   └── score.service.ts
│   ├── schemas/               # Zod validation schemas + TypeScript types
│   │   ├── auth.schema.ts
│   │   ├── otp.schema.ts
│   │   ├── folder.schema.ts
│   │   ├── list.schema.ts
│   │   ├── node.schema.ts
│   │   └── tag.schema.ts
│   ├── jobs/                  # BullMQ background workers (stub)
│   │   ├── queue.ts
│   │   ├── reminder.job.ts
│   │   └── rollover.job.ts
│   └── types/
│       └── express.d.ts       # Extends Express Request with req.user
├── prisma.config.ts           # Prisma 7 datasource URL config
├── tsconfig.json              # TypeScript compiler config (strict mode)
├── .env                       # Environment variables (gitignored)
├── .env.example               # Template for required env vars
├── PLAN.md                    # Product specification & API design
└── PHASE_WISE_EXECUTION.md    # Phase-by-phase implementation roadmap
```

### Database Schema (11 Models)

| Model | Purpose |
|---|---|
| `User` | Accounts with email/phone, password hash, 2FA settings |
| `Folder` | Top-level organizational containers |
| `List` | Task boards within folders |
| `Node` | Tasks/sub-tasks with infinite nesting via self-referential `parentId` |
| `Tag` | Color labels, global or list-scoped |
| `NodeTag` | Many-to-many join between nodes and tags |
| `DailyScore` | Immutable daily productivity scores |
| `OtpCode` | Hashed OTP codes for email/phone/2FA verification |
| `Plan` | Subscription tiers (Free, Pro, Team) |
| `Subscription` | User ↔ Plan link with billing cycle tracking |
| `Payment` | Individual payment records with gateway tracking |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A **PostgreSQL** database (we use [Neon](https://neon.tech) — free tier works)
- **Redis** (required for BullMQ background jobs — Phase 4)

### 1. Clone & Install

```bash
git clone https://github.com/pranavdadhe1806/StrataNodex-backend.git
cd StrataNodex-backend
npm install
```

### 2. Configure Environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | Random 32+ character secret for signing tokens | `3f8a2b7c9d1e4f6a...` |
| `JWT_EXPIRES_IN` | Token expiration duration | `7d` |
| `PORT` | Server port | `3000` |
| `REDIS_URL` | Redis connection (for BullMQ) | `redis://localhost:6379` |

**Generate a secure JWT secret:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run Database Migration

```bash
npx prisma migrate dev --name "init"
npx prisma generate
```

### 4. Start Development Server

```bash
npm run dev
```

The server starts at `http://localhost:3000`.

### Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `ts-node-dev --respawn` | Hot-reload dev server |
| `npm run build` | `tsc` | Compile TypeScript to `dist/` |
| `npm start` | `node dist/index.js` | Run production build |
| `npm run db:migrate` | `prisma migrate dev` | Run pending migrations |
| `npm run db:generate` | `prisma generate` | Regenerate Prisma client |
| `npm run db:studio` | `prisma studio` | Open Prisma Studio GUI |

---

## API Endpoints

### Auth (`/api/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | Public | Register with email + password |
| `POST` | `/login` | Public | Login, returns JWT token |
| `GET` | `/me` | Protected | Get current user profile |
| `POST` | `/verify-email` | Protected | Verify email with 6-digit OTP |
| `POST` | `/verify-phone` | Protected | Verify phone with 6-digit OTP |
| `POST` | `/resend-otp` | Protected | Resend OTP (any type/channel) |
| `POST` | `/phone-login` | Public | Request OTP for phone-based login |
| `POST` | `/phone-login/verify` | Public | Verify phone OTP and get token |
| `POST` | `/forgot-password` | Public | Request password reset OTP |
| `POST` | `/reset-password` | Public | Reset password with OTP |
| `POST` | `/2fa/enable` | Protected | Enable two-factor authentication |
| `POST` | `/2fa/disable` | Protected | Disable two-factor authentication |
| `POST` | `/2fa/verify` | Public | Complete 2FA login with OTP |

### OTP (`/api/otp`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/verify-email` | Protected | Verify email ownership |
| `POST` | `/verify-phone` | Protected | Verify phone ownership |
| `POST` | `/resend` | Protected | Resend any OTP type |

### Folders, Lists, Nodes, Tags, Scores (Phase 2+)

These endpoints are scaffolded but not yet implemented. See `PHASE_WISE_EXECUTION.md` for the full roadmap.

---

## Dependencies

### Production

| Package | Version | Purpose |
|---|---|---|
| `express` | 5.2.1 | Web framework |
| `@prisma/client` | 7.7.0 | Database ORM client |
| `@prisma/adapter-pg` | 7.7.0 | PostgreSQL driver adapter for Prisma 7 |
| `pg` | 8.20.0 | Node.js PostgreSQL driver |
| `prisma` | 7.7.0 | Prisma CLI (migrations, generate) |
| `bcrypt` | 6.0.0 | Password and OTP hashing |
| `jsonwebtoken` | 9.0.3 | JWT token generation and verification |
| `zod` | 4.3.6 | Runtime request body validation |
| `cors` | 2.8.6 | Cross-Origin Resource Sharing |
| `helmet` | 8.1.0 | Security headers |
| `morgan` | 1.10.1 | HTTP request logging |
| `dotenv` | 17.4.2 | Environment variable loading |
| `express-rate-limit` | 8.3.2 | API rate limiting (Phase 6) |
| `bullmq` | 5.73.5 | Background job queue (Phase 4) |
| `ioredis` | 5.10.1 | Redis client for BullMQ (Phase 4) |

### Development

| Package | Version | Purpose |
|---|---|---|
| `typescript` | 6.0.2 | TypeScript compiler |
| `ts-node-dev` | 2.0.0 | Hot-reload TypeScript execution |
| `@prisma/config` | 7.7.0 | Prisma 7 config file support |
| `@types/bcrypt` | 6.0.0 | Type definitions for bcrypt |
| `@types/cors` | 2.8.19 | Type definitions for cors |
| `@types/express` | 5.0.6 | Type definitions for Express 5 |
| `@types/jsonwebtoken` | 9.0.10 | Type definitions for jsonwebtoken |
| `@types/morgan` | 1.9.10 | Type definitions for morgan |
| `@types/node` | 25.6.0 | Type definitions for Node.js |
| `@types/pg` | 8.20.0 | Type definitions for pg driver |

---

## Implementation Status

| Phase | Description | Status |
|---|---|---|
| Phase 0 | Database migration & Prisma setup | ✅ Complete |
| Phase 1 | Auth system (JWT, OTP, 2FA, password reset) | ✅ Complete |
| Phase 2 | Core CRUD (Folders, Lists, Nodes, Tags) | ⬜ Not started |
| Phase 3 | Gamification (Daily scores, streaks) | ⬜ Not started |
| Phase 4 | Background jobs (Reminders, rollover) | ⬜ Not started |
| Phase 5 | Payments (Razorpay/Stripe subscriptions) | ⬜ Not started |
| Phase 6 | Production (Rate limiting, Docker, CI/CD) | ⬜ Not started |

See [`PHASE_WISE_EXECUTION.md`](./PHASE_WISE_EXECUTION.md) for the complete, detailed roadmap.

---

## License

ISC
