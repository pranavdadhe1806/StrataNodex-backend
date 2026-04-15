# StrataNodex Backend — Phase-Wise Execution Plan

> **For AI agents:** This is the single source of truth for what to build, in what order,
> and how to build it. Do not deviate from the architecture rules. Do not implement a later
> phase before the previous one is verified. Do not hallucinate new tables or fields —
> the schema is final. Every function, file, and route is specified explicitly below.

---

## Current State (as of plan creation — April 2026)

### ✅ Already Done
- `package.json`, `tsconfig.json`, all npm deps installed
- Full `src/` folder structure created (routes, controllers, services, schemas, middleware, jobs, types, config)
- **Prisma schema is final** — do not redesign it
- `prisma.config.ts` created (Prisma 7 datasource config)
- All route/controller/service files exist with TODO stubs
- `src/config/env.ts` — env loader with validation
- `src/config/prisma.ts` — PrismaClient singleton
- `src/middleware/auth.middleware.ts` — JWT verify, attaches `req.user`
- `src/middleware/errorHandler.ts` — global error handler
- `src/middleware/validate.ts` — Zod middleware factory
- `src/types/express.d.ts` — `req.user: { id: string }` extension
- `tsc --noEmit` passes with zero errors

### ❌ Not Yet Done
- Database NOT migrated — no tables exist in Neon yet
- `.env` has placeholder values — user must fill in real `DATABASE_URL` and `JWT_SECRET`
- All service files are stubs — no real logic implemented
- Auth, OTP, 2FA, payments — all unbuilt
- BullMQ jobs are stubs

---

## Final Schema — Tables Reference

> The schema at `prisma/schema.prisma` is final. Do not add or remove models.

| Model | Purpose |
|---|---|
| `User` | Identity, phone/email, verification flags, 2FA settings |
| `OtpCode` | Hashed OTPs for verify/login/reset — one table, typed by `OtpType` |
| `Folder` | Groups of lists owned by a user |
| `List` | Groups of tasks inside a folder |
| `Node` | Tasks — infinite nesting via self-referential `parentId` |
| `Tag` | Labels — global (`listId=null`) or list-scoped (`listId=set`) |
| `NodeTag` | Join table for Node ↔ Tag many-to-many |
| `DailyScore` | Gamification scores — append-only, one row per `[userId, listId, date]` |
| `Plan` | Subscription tiers (seeded by admin, not created by users) |
| `Subscription` | Links a user to a plan, stores gateway IDs |
| `Payment` | Individual payment transaction records |

---

## Architecture Rules — Never Break These

1. **Controllers are dumb.** One service call + `res.json()`. Zero business logic.
2. **Services own everything.** All DB queries, all `WHERE userId = ?` scoping, all calculations.
3. **Never expose `passwordHash`.** Use `select` or destructure it out of every user response.
4. **Always scope to `req.user.id`.** Never trust ownership from `req.body` or `req.params`.
5. **Cascade deletes via Prisma schema.** Never manually delete children.
6. **`canvasX` / `canvasY` are nullable.** CLI never sends them. Always treat as optional.
7. **`DailyScore` is append-only.** Once written for a date, never update. Throw if row exists.
8. **OTP codes are stored hashed.** Use `bcrypt.hash()`. Never store plaintext.
9. **`passwordHash` is optional on `User`.** OTP-only signups have no password. Never assume it exists.
10. **TypeScript strict mode is on.** Use `String(req.params.id)` for all `req.params`. No `any`.

---

## Phase 0 — Database Migration

**Goal:** Create all tables in Neon. Do this before writing any service logic.

### Pre-requisites
User must set real values in `.env`:
```
DATABASE_URL=postgresql://...    ← from Neon dashboard → Connection string
JWT_SECRET=<32+ random chars>
JWT_EXPIRES_IN=7d
PORT=3000
REDIS_URL=redis://localhost:6379
```

### Commands
```bash
npx prisma migrate dev --name "init"
npx prisma generate
npm run db:studio   # open Prisma Studio GUI to verify
```

### Verification
- [ ] Migration runs without errors
- [ ] `prisma/migrations/` folder created with SQL file
- [ ] All 11 tables visible in Prisma Studio: `User`, `OtpCode`, `Folder`, `List`, `Node`, `Tag`, `NodeTag`, `DailyScore`, `Plan`, `Subscription`, `Payment`
- [ ] `npm run dev` prints `StrataNodex API running on port 3000`

---

## Phase 1 — Auth System

**Goal:** Full authentication: password login, OTP via email/phone, 2FA, password reset.

> Do NOT touch Phase 2 until Phase 1 is fully verified end-to-end.

### New files to CREATE in this phase
```
src/schemas/otp.schema.ts
src/services/otp.service.ts
src/controllers/otp.controller.ts
src/routes/otp.routes.ts
```

### Files to IMPLEMENT (currently stubs)
```
src/schemas/auth.schema.ts        ← add new schemas
src/services/auth.service.ts      ← replace all stubs
src/controllers/auth.controller.ts ← replace all stubs
src/routes/auth.routes.ts         ← add all new routes
```

Also register `otpRoutes` in `src/app.ts`:
```ts
import otpRoutes from './routes/otp.routes'
app.use('/api/otp', otpRoutes)
```

---

### 1A — OTP Service (`src/services/otp.service.ts`)

This is the foundation of all auth flows. Build it first.

```ts
generateOtp(userId: string, type: OtpType, channel: OtpChannel): Promise<string>
  // 1. generate a 6-digit numeric string: Math.floor(100000 + Math.random() * 900000).toString()
  // 2. hash it with bcrypt (rounds: 10)
  // 3. delete any existing unused OtpCode for same userId + type (prevent accumulation)
  // 4. create OtpCode row: { userId, code: hashed, type, channel, expiresAt: now + 10min }
  // 5. return the plain 6-digit code (caller sends it to user via email/SMS)

verifyOtp(userId: string, plainCode: string, type: OtpType): Promise<void>
  // 1. find latest OtpCode where userId + type + usedAt IS NULL, orderBy createdAt DESC
  // 2. if not found: throw Error('OTP not found or already used')
  // 3. if expiresAt < now: throw Error('OTP has expired')
  // 4. bcrypt.compare(plainCode, row.code) — if false: throw Error('Invalid OTP')
  // 5. update OtpCode: set usedAt = now()

markEmailVerified(userId: string): Promise<void>
  // prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } })

markPhoneVerified(userId: string): Promise<void>
  // prisma.user.update({ where: { id: userId }, data: { isPhoneVerified: true } })
```

---

### 1B — Auth Service (`src/services/auth.service.ts`)

Replace all stubs with these implementations:

```ts
registerWithPassword(input: { email: string; password: string; name?: string })
  // 1. check if email already exists — throw 'Email already in use' if so
  // 2. bcrypt.hash(password, 12)
  // 3. create User: { email, passwordHash, name, isEmailVerified: false }
  // 4. call generateOtp(userId, VERIFY_EMAIL, EMAIL)
  // 5. console.log(`[DEV] Email OTP for ${email}: ${otp}`) — real email in Phase 5
  // 6. return { user: omit(user, 'passwordHash'), message: 'Check your email for OTP' }

loginWithPassword(input: { email: string; password: string })
  // 1. find user by email — throw 'Invalid credentials' if not found
  // 2. if !user.passwordHash: throw 'This account uses OTP login'
  // 3. bcrypt.compare(password, user.passwordHash) — throw 'Invalid credentials' if false
  // 4. if user.twoFactorEnabled:
  //    → generateOtp(userId, TWO_FACTOR, user.twoFactorMethod as OtpChannel)
  //    → console.log(`[DEV] 2FA OTP: ${otp}`)
  //    → return { requiresTwoFactor: true, userId: user.id }
  // 5. jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })
  // 6. return { user: omit(user, 'passwordHash'), token }

getMe(userId: string)
  // prisma.user.findUniqueOrThrow with select that excludes passwordHash

requestPhoneOtp(phone: string)
  // 1. find user by phone — throw 'No account found with this number' if not found
  // 2. generateOtp(userId, TWO_FACTOR, SMS)
  // 3. console.log(`[DEV] Phone OTP for ${phone}: ${otp}`)
  // 4. return { message: 'OTP sent to your phone' }

verifyPhoneLogin(input: { phone: string; code: string })
  // 1. find user by phone
  // 2. verifyOtp(userId, code, TWO_FACTOR)
  // 3. jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })
  // 4. return { user: omit(user, 'passwordHash'), token }

requestPasswordReset(email: string)
  // 1. find user by email — silently return if not found (don't leak existence)
  // 2. generateOtp(userId, PASSWORD_RESET, EMAIL)
  // 3. console.log(`[DEV] Password reset OTP for ${email}: ${otp}`)
  // 4. return { message: 'If the email exists, you will receive an OTP' }

resetPassword(input: { email: string; code: string; newPassword: string })
  // 1. find user by email — throw 'Invalid request' if not found
  // 2. verifyOtp(userId, code, PASSWORD_RESET)
  // 3. bcrypt.hash(newPassword, 12)
  // 4. prisma.user.update: set passwordHash = hashed
  // 5. return { message: 'Password reset successful' }

enable2FA(userId: string, method: TwoFactorMethod)
  // prisma.user.update: { twoFactorEnabled: true, twoFactorMethod: method }
  // return updated user without passwordHash

disable2FA(userId: string)
  // prisma.user.update: { twoFactorEnabled: false, twoFactorMethod: null }
  // return updated user without passwordHash

verify2FA(input: { userId: string; code: string })
  // 1. verifyOtp(userId, code, TWO_FACTOR)
  // 2. fetch user
  // 3. jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })
  // 4. return { user: omit(user, 'passwordHash'), token }

verifyEmailOtp(userId: string, code: string)
  // 1. verifyOtp(userId, code, VERIFY_EMAIL)
  // 2. markEmailVerified(userId)
  // 3. return { message: 'Email verified' }

verifyPhoneOtp(userId: string, code: string)
  // 1. verifyOtp(userId, code, VERIFY_PHONE)
  // 2. markPhoneVerified(userId)
  // 3. return { message: 'Phone verified' }

resendOtp(userId: string, type: OtpType, channel: OtpChannel)
  // 1. generateOtp(userId, type, channel)
  // 2. console.log(`[DEV] Resent OTP: ${otp}`)
  // 3. return { message: 'OTP resent' }
```

---

### 1C — Zod Schemas

**`src/schemas/auth.schema.ts`** — add these schemas:
```ts
registerSchema        → z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() })
loginSchema           → z.object({ email: z.string().email(), password: z.string() })
phoneOtpRequestSchema → z.object({ phone: z.string().regex(/^\+[1-9]\d{6,14}$/) })
phoneOtpVerifySchema  → z.object({ phone: z.string(), code: z.string().length(6) })
forgotPasswordSchema  → z.object({ email: z.string().email() })
resetPasswordSchema   → z.object({ email: z.string().email(), code: z.string().length(6), newPassword: z.string().min(8) })
enable2FASchema       → z.object({ method: z.enum(['EMAIL', 'SMS', 'TOTP']) })
verify2FASchema       → z.object({ userId: z.string(), code: z.string().length(6) })
```

**`src/schemas/otp.schema.ts`**:
```ts
verifyOtpSchema → z.object({ code: z.string().length(6) })
resendOtpSchema → z.object({ type: z.nativeEnum(OtpType), channel: z.nativeEnum(OtpChannel) })
```

---

### 1D — Routes (`src/routes/auth.routes.ts`)

Full route table — replace existing stubs:
```
POST  /api/auth/register              → registerWithPassword     [PUBLIC]
POST  /api/auth/login                 → loginWithPassword        [PUBLIC]
GET   /api/auth/me                    → getMe                    [PROTECTED]

POST  /api/auth/verify-email          → verifyEmailOtp           [PROTECTED]
POST  /api/auth/verify-phone          → verifyPhoneOtp           [PROTECTED]
POST  /api/auth/resend-otp            → resendOtp                [PROTECTED]

POST  /api/auth/phone-login           → requestPhoneOtp          [PUBLIC]
POST  /api/auth/phone-login/verify    → verifyPhoneLogin         [PUBLIC]

POST  /api/auth/forgot-password       → requestPasswordReset     [PUBLIC]
POST  /api/auth/reset-password        → resetPassword            [PUBLIC]

POST  /api/auth/2fa/enable            → enable2FA                [PROTECTED]
POST  /api/auth/2fa/disable           → disable2FA               [PROTECTED]
POST  /api/auth/2fa/verify            → verify2FA                [PUBLIC — mid-login step]
```

---

### Phase 1 Verification Checklist
- [ ] `POST /api/auth/register` → creates user, logs OTP to console
- [ ] `POST /api/auth/verify-email` → `isEmailVerified` becomes `true`
- [ ] `POST /api/auth/login` → returns JWT token
- [ ] Wrong password → 401 with `Invalid credentials`
- [ ] `GET /api/auth/me` → returns user, `passwordHash` is NOT in response
- [ ] `GET /api/auth/me` with no token → 401
- [ ] `POST /api/auth/forgot-password` → OTP logged to console
- [ ] `POST /api/auth/reset-password` → password updated, old password no longer works
- [ ] `POST /api/auth/2fa/enable` → login now returns `{ requiresTwoFactor: true }`
- [ ] `POST /api/auth/2fa/verify` with correct code → returns JWT
- [ ] Reusing an already-used OTP → throws error
- [ ] Expired OTP (wait 10+ minutes or mock time) → throws error
- [ ] `tsc --noEmit` passes

---

## Phase 2 — Core CRUD API

**Goal:** Full CRUD for Folders, Lists, Nodes, Tags, Daily views. These are the endpoints the CLI and web clients use every day.

> All routes are protected by `authenticate` middleware unless stated otherwise.

---

### 2A — Folders (`src/services/folder.service.ts`)

```ts
getFolders(userId: string)
  // prisma.folder.findMany({ where: { userId }, orderBy: { position: 'asc' },
  //   include: { lists: { select: { id, name, position }, orderBy: { position: 'asc' } } } })

createFolder(userId: string, input: { name: string; position?: number })
  // prisma.folder.create({ data: { name, userId, position: input.position ?? 0 } })

updateFolder(userId: string, folderId: string, input: { name?: string; position?: number })
  // 1. findFirst({ where: { id: folderId, userId } }) — throw 404 if missing
  // 2. prisma.folder.update({ where: { id: folderId }, data: input })

deleteFolder(userId: string, folderId: string)
  // 1. verify ownership
  // 2. prisma.folder.delete (Prisma cascades → lists → nodes automatically)
```

Routes: `GET /api/folders`, `POST /api/folders`, `PATCH /api/folders/:id`, `DELETE /api/folders/:id`

---

### 2B — Lists (`src/services/list.service.ts`)

```ts
getLists(userId: string, folderId: string)
  // 1. verify folder ownership: findFirst({ where: { id: folderId, userId } })
  // 2. prisma.list.findMany({ where: { folderId }, orderBy: { position: 'asc' } })

createList(userId: string, input: { name: string; folderId: string; position?: number })
  // 1. verify folder ownership
  // 2. prisma.list.create

updateList(userId: string, listId: string, input: { name?: string; position?: number })
  // 1. verify ownership: findFirst({ where: { id: listId, folder: { userId } } })
  // 2. prisma.list.update

deleteList(userId: string, listId: string)
  // 1. verify ownership
  // 2. prisma.list.delete (cascades → nodes)
```

Routes:
```
GET    /api/folders/:folderId/lists
POST   /api/lists
PATCH  /api/lists/:id
DELETE /api/lists/:id
```

---

### 2C — Nodes (`src/services/node.service.ts`)

```ts
getNodes(userId: string, listId: string)
  // 1. verify list ownership: findFirst({ where: { id: listId, folder: { userId } } })
  // 2. prisma.node.findMany({ where: { listId }, orderBy: { position: 'asc' },
  //      include: { tags: { include: { tag: true } }, children: { orderBy: { position: 'asc' } } } })

getNodeById(userId: string, nodeId: string)
  // 1. verify ownership: findFirst({ where: { id: nodeId, list: { folder: { userId } } } })
  // 2. prisma.node.findUnique with full include

createNode(userId: string, input: CreateNodeInput)
  // 1. verify list ownership (using input.listId)
  // 2. if input.parentId: verify parent node is in the same list
  // 3. prisma.node.create
  // 4. if input.tagIds: create NodeTag rows
  // 5. if input.reminderAt: schedule BullMQ reminder job (Phase 4 — skip for now)

updateNode(userId: string, nodeId: string, input: UpdateNodeInput)
  // 1. verify ownership
  // 2. if input.tagIds provided: deleteMany NodeTags, then create new ones
  // 3. prisma.node.update

deleteNode(userId: string, nodeId: string)
  // 1. verify ownership
  // 2. prisma.node.delete (Prisma cascades children recursively)

moveNode(userId: string, nodeId: string, input: { parentId: string | null; position: number })
  // 1. verify node ownership
  // 2. if parentId: verify new parent is in same list
  // 3. prisma.node.update({ data: { parentId, position } })
```

Routes:
```
GET    /api/lists/:listId/nodes
POST   /api/lists/:listId/nodes        ← create root node
POST   /api/nodes/:parentId/children   ← create sub-node
GET    /api/nodes/:id
PATCH  /api/nodes/:id
DELETE /api/nodes/:id
PATCH  /api/nodes/:id/move
```

---

### 2D — Tags (`src/services/tag.service.ts`)

```ts
getTags(userId: string, listId?: string)
  // if listId: return tags where userId=userId AND (listId=null OR listId=listId)
  // if no listId: return tags where userId=userId AND listId=null

createTag(userId: string, input: { name: string; color?: string; listId?: string })
  // if listId: verify list ownership first
  // prisma.tag.create

updateTag(userId: string, tagId: string, input: { name?: string; color?: string })
  // verify tag.userId === userId
  // prisma.tag.update

deleteTag(userId: string, tagId: string)
  // verify ownership then delete (NodeTag rows cascade)

attachTag(userId: string, nodeId: string, tagId: string)
  // 1. verify node ownership
  // 2. verify tag.userId === userId
  // 3. prisma.nodeTag.create({ data: { nodeId, tagId } }) — use upsert/skip if exists

detachTag(userId: string, nodeId: string, tagId: string)
  // verify node ownership
  // prisma.nodeTag.delete({ where: { nodeId_tagId: { nodeId, tagId } } })
```

Routes:
```
GET    /api/tags                         ← ?listId=xxx optional
POST   /api/tags
PATCH  /api/tags/:id
DELETE /api/tags/:id
POST   /api/nodes/:id/tags/:tagId        ← attach
DELETE /api/nodes/:id/tags/:tagId        ← detach
```

---

### 2E — Daily Views (`src/services/daily.service.ts`)

> Dynamic queries on existing data. No new tables.

```ts
getTodayNodes(userId: string)
  // const today = new Date(); today.setHours(0, 0, 0, 0)
  // const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  // prisma.node.findMany where:
  //   list.folder.userId === userId
  //   status !== DONE
  //   (startAt <= tomorrow AND endAt >= today)
  //   OR startAt between today and tomorrow (date-only tasks)
  // include tags

getOverdueNodes(userId: string)
  // prisma.node.findMany where:
  //   list.folder.userId === userId
  //   status !== DONE
  //   endAt < today
  // include tags
```

Routes: `GET /api/daily/today`, `GET /api/daily/overdue`

---

### Phase 2 Verification Checklist
- [ ] Create folder → GET /api/folders returns it with empty lists array
- [ ] Create list in folder → GET /api/folders/:folderId/lists returns it
- [ ] Create root node → GET /api/lists/:listId/nodes returns it
- [ ] Create sub-node with parentId set → appears in parent's `children` array
- [ ] Update node status to DONE
- [ ] Delete folder → its lists and nodes are also gone
- [ ] Create global tag (no listId) → visible in all lists
- [ ] Create local tag (with listId) → only visible via `?listId=` query
- [ ] Attach tag → appears in node's `tags` array
- [ ] Detach tag → removed from node
- [ ] Node with startAt=today, endAt=today → appears in /api/daily/today
- [ ] Node with endAt=yesterday, status=TODO → appears in /api/daily/overdue
- [ ] All routes return 401 with no JWT
- [ ] User A cannot read/edit User B's data
- [ ] `tsc --noEmit` passes

---

## Phase 3 — Gamification (Daily Scores + Streaks)

**Goal:** Scoring system, score history, streak calculation.

### 3A — Score Service (`src/services/score.service.ts`)

```ts
computeAndStoreDailyScore(userId: string, date: string, listId?: string)
  // SCORING FORMULA (from PLAN.md):
  //   ≥ 90% done  → +3
  //   60–89%      → +2
  //   30–59%      → +1
  //   1–29%       →  0
  //   0%          → -1
  //
  // 1. check @@unique([userId, listId, date]) — throw 409 if already exists (immutable rule)
  // 2. if listId: count nodes in that list only
  //    if no listId: count ALL nodes across all user's lists
  // 3. compute pct = doneTasks / totalTasks * 100 (handle totalTasks=0 as 0%)
  // 4. apply formula to get points
  // 5. prisma.dailyScore.create({ data: { userId, listId: listId ?? null, date, totalTasks, doneTasks, points } })

getScoreHistory(userId: string, listId?: string, limit = 30)
  // prisma.dailyScore.findMany({
  //   where: { userId, listId: listId ?? null },
  //   orderBy: { date: 'desc' }, take: limit
  // })

getCurrentStreak(userId: string)
  // 1. fetch all overall scores (listId=null) ordered by date DESC
  // 2. walk backwards through dates: count consecutive days where points > 0
  // 3. break as soon as a day has points <= 0 or a date is missing in the chain
  // 4. return streak count as number
```

### 3B — Routes (`src/routes/score.routes.ts` and `src/routes/daily.routes.ts`)

```
GET   /api/scores                  ← overall history (default last 30)
GET   /api/scores?listId=xxx       ← per-list history
GET   /api/scores/streak           ← { streak: number }
POST  /api/daily/compute           ← { date: 'YYYY-MM-DD', listId? }
GET   /api/daily/:date             ← get score row for one date
```

### Phase 3 Verification Checklist
- [ ] Complete some tasks, POST /api/daily/compute → row created with correct points
- [ ] POST same userId+date+listId again → 409 error
- [ ] 0 tasks done → points = -1
- [ ] 9/10 tasks done → points = +3
- [ ] GET /api/scores returns history ordered newest first
- [ ] GET /api/scores/streak returns correct consecutive count

---

## Phase 4 — BullMQ Jobs

**Goal:** Background job processing for reminders and midnight rollover.

### Prerequisites
- Redis must be running: `docker run -d -p 6379:6379 redis:alpine`
- Or use Upstash (cloud Redis, free tier)
- `REDIS_URL` must be set in `.env`

### 4A — Queue Setup (`src/jobs/queue.ts`)

```ts
import { Queue } from 'bullmq'
import { env } from '../config/env'

const connection = { url: env.REDIS_URL }

export const reminderQueue = new Queue('reminders', { connection })
export const rolloverQueue = new Queue('rollover', { connection })
```

### 4B — Reminder Job (`src/jobs/reminder.job.ts`)

```ts
// Worker processes jobs from reminderQueue
// Job payload: { nodeId: string; userId: string }
// Logic:
//   1. Fetch node from DB
//   2. if node missing or status === DONE: skip (node completed before reminder fired)
//   3. console.log(`[REMINDER] Node "${node.title}" is due for user ${userId}`)
//   4. Phase 5+: replace with real push notification / email / SMS

// Add jobs to queue in node.service.ts when reminderAt is set:
//   reminderQueue.add('reminder', { nodeId, userId },
//     { delay: new Date(reminderAt).getTime() - Date.now() })
// Do this inside createNode and updateNode when reminderAt is present.
```

### 4C — Rollover Job (`src/jobs/rollover.job.ts`)

```ts
// Worker processes jobs from rolloverQueue
// Job payload: { userId: string; listId?: string; date: string }
// Logic:
//   calls score.service.computeAndStoreDailyScore(userId, date, listId)

// Scheduling for MVP: manually triggered via POST /api/daily/compute
// Full implementation: a node-cron job that fires every minute,
//   checks which users' dayEndTime matches current time,
//   and enqueues rollover jobs for them.
```

### Phase 4 Verification Checklist
- [ ] `npm run dev` starts without Redis errors (queues connect)
- [ ] Create node with reminderAt 1 minute from now → reminder logged after 1 minute
- [ ] POST /api/daily/compute enqueues rollover job

---

## Phase 5 — Payments

**Goal:** Subscription plans, gateway integration (Razorpay as primary), webhook handling.

### New files to create
```
src/services/payment.service.ts
src/services/subscription.service.ts
src/controllers/payment.controller.ts
src/controllers/subscription.controller.ts
src/routes/payment.routes.ts
src/routes/subscription.routes.ts
src/schemas/payment.schema.ts
prisma/seed.ts
```

### 5A — Plan Seeding (`prisma/seed.ts`)

Seed these plans — they are not created by users:
```ts
// Free: price=0, features={ maxLists: 5, reminderEnabled: false }
// Pro:  price=299 (INR), features={ maxLists: 50, reminderEnabled: true }
// Team: price=799 (INR), features={ maxLists: 500, reminderEnabled: true, teamMembers: 5 }

// Add to package.json: "prisma": { "seed": "ts-node prisma/seed.ts" }
// Run: npx prisma db seed
```

### 5B — Subscription Service (`src/services/subscription.service.ts`)

```ts
getAllPlans()
  // prisma.plan.findMany({ where: { isActive: true } })

getMySubscription(userId: string)
  // prisma.subscription.findUnique({ where: { userId }, include: { plan: true } })

getSubscriptionStatus(userId: string)
  // fetch subscription
  // return { status, plan, daysRemaining: Math.ceil((currentPeriodEnd - now) / 86400000) }

cancelSubscription(userId: string)
  // prisma.subscription.update: { cancelAtPeriodEnd: true, status: CANCELLED }
```

### 5C — Payment Service (`src/services/payment.service.ts`)

```ts
createOrder(userId: string, planId: string)
  // 1. fetch plan by ID
  // 2. call Razorpay: razorpay.orders.create({ amount: plan.price * 100, currency: 'INR' })
  // 3. create Payment row: { userId, amount, currency, status: PENDING, gateway: 'razorpay',
  //      gatewayOrderId: order.id }
  // 4. return { orderId: order.id, amount, currency, keyId: RAZORPAY_KEY_ID }

verifyAndCapturePayment(userId: string, input: { gatewayPaymentId; gatewayOrderId; signature; planId })
  // 1. verify Razorpay HMAC: crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
  //      .update(orderId + '|' + paymentId).digest('hex') === signature
  // 2. if invalid: throw 'Invalid payment signature'
  // 3. update Payment: { status: PAID, gatewayPaymentId, paidAt: now }
  // 4. upsert Subscription: {
  //      userId, planId, status: ACTIVE,
  //      currentPeriodStart: now,
  //      currentPeriodEnd: now + 30 days (MONTHLY) or 365 days (YEARLY)
  //    }
  // 5. return { message: 'Payment successful', subscription }

handleWebhook(rawBody: Buffer, signature: string)
  // 1. Razorpay.validateWebhookSignature(rawBody.toString(), signature, WEBHOOK_SECRET)
  // 2. parse event type
  // 3. payment.captured: update Payment status=PAID
  // 4. subscription.cancelled: update Subscription status=CANCELLED
  // 5. payment.failed: update Payment status=FAILED
```

### 5D — Routes

```
GET   /api/plans                       → getAllPlans         [PUBLIC]
GET   /api/subscription/me             → getMySubscription   [PROTECTED]
GET   /api/subscription/status         → getSubscriptionStatus [PROTECTED]
POST  /api/subscription/cancel         → cancelSubscription  [PROTECTED]
POST  /api/payments/order              → createOrder         [PROTECTED]
POST  /api/payments/verify             → verifyAndCapture    [PROTECTED]
POST  /api/payments/webhook            → handleWebhook       [PUBLIC — sig-verified, no JWT]
```

> For the webhook route: use `express.raw({ type: 'application/json' })` as middleware instead of `express.json()` so the raw body is available for signature verification.

### Phase 5 Verification Checklist
- [ ] `npx prisma db seed` inserts Free, Pro, Team plans
- [ ] GET /api/plans returns 3 plans
- [ ] POST /api/payments/order returns valid Razorpay order ID
- [ ] POST /api/payments/verify with valid signature → Subscription is ACTIVE
- [ ] POST /api/payments/webhook with tampered payload → 400 error
- [ ] POST /api/subscription/cancel → cancelAtPeriodEnd=true

---

## Phase 6 — Production Hardening

**Goal:** Security, observability, Docker, CI/CD, deployment.

### 6A — Rate Limiting (`src/app.ts` or separate middleware file)

```ts
import rateLimit from 'express-rate-limit'

// General API limiter
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })

// Strict limiter for auth routes
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,
  message: { error: 'Too many attempts, please try again later' } })

// Very strict for OTP routes (prevent brute force)
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 3 })

app.use('/api', generalLimiter)
app.use('/api/auth', authLimiter)
app.use('/api/otp', otpLimiter)
```

### 6B — Security Headers

`helmet()` is already applied in `app.ts`. Add CORS origin whitelist:
```ts
app.use(cors({
  origin: env.ALLOWED_ORIGINS.split(','),
  credentials: true,
}))
```

Add `ALLOWED_ORIGINS` to `.env` and `env.ts`.

### 6C — Error Handler (Production Mode)

In `src/middleware/errorHandler.ts`:
```ts
// In production, never send stack traces
const message = process.env.NODE_ENV === 'production'
  ? 'Internal server error'
  : err.message
res.status(500).json({ error: message })
```

### 6D — Docker

Create in project root:

**`Dockerfile`**:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**`docker-compose.yml`**:
```yaml
services:
  api:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [redis]
  redis:
    image: redis:alpine
    ports: ["6379:6379"]
```

**`.dockerignore`**: `node_modules`, `dist`, `.env`

### 6E — GitHub Actions CI/CD

**`.github/workflows/deploy.yml`**:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx tsc --noEmit        # type-check before deploy
      - run: curl ${{ secrets.RENDER_DEPLOY_HOOK }}  # triggers Render deploy
```

Set `RENDER_DEPLOY_HOOK` in GitHub repo secrets (from Render dashboard → your service → Deploy Hook).

### 6F — Deployment Services

| Service | What it hosts | Free tier |
|---|---|---|
| **Render** | Node.js API | Yes (spins down after inactivity) |
| **Neon** | PostgreSQL | Yes (always on) |
| **Upstash** | Redis (BullMQ) | Yes (serverless) |

Set all env vars in Render dashboard. Do NOT commit `.env`.

### Phase 6 Verification Checklist
- [ ] Hit `/api/auth/login` 11 times → get 429 Too Many Requests
- [ ] `docker-compose up` → both api and redis start cleanly
- [ ] Push to main → GitHub Action runs type-check → Render deploys
- [ ] Production URL: `GET /api/auth/me` with no token → 401 (not 500, not stack trace)
- [ ] Production: error responses contain no stack trace

---

## Complete File Status Table

| File | Phase | Status |
|---|---|---|
| `prisma/schema.prisma` | Phase 0 | ✅ Final — do not change |
| `prisma/seed.ts` | Phase 5 | ❌ Create |
| `src/index.ts` | Done | ✅ |
| `src/app.ts` | Phase 6 (rate limits) | ✅ Partial |
| `src/config/env.ts` | Done | ✅ |
| `src/config/prisma.ts` | Done | ✅ |
| `src/types/express.d.ts` | Done | ✅ |
| `src/middleware/auth.middleware.ts` | Done | ✅ |
| `src/middleware/errorHandler.ts` | Phase 6 | ✅ Partial |
| `src/middleware/validate.ts` | Done | ✅ |
| `src/schemas/auth.schema.ts` | Phase 1 | ⚠️ Stub — implement |
| `src/schemas/otp.schema.ts` | Phase 1 | ❌ Create |
| `src/schemas/folder.schema.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/schemas/list.schema.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/schemas/node.schema.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/schemas/tag.schema.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/schemas/payment.schema.ts` | Phase 5 | ❌ Create |
| `src/services/auth.service.ts` | Phase 1 | ⚠️ Stub — implement |
| `src/services/otp.service.ts` | Phase 1 | ❌ Create |
| `src/services/folder.service.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/services/list.service.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/services/node.service.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/services/tag.service.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/services/daily.service.ts` | Phase 2+3 | ⚠️ Stub — implement |
| `src/services/score.service.ts` | Phase 3 | ⚠️ Stub — implement |
| `src/services/payment.service.ts` | Phase 5 | ❌ Create |
| `src/services/subscription.service.ts` | Phase 5 | ❌ Create |
| `src/controllers/auth.controller.ts` | Phase 1 | ⚠️ Stub — implement |
| `src/controllers/otp.controller.ts` | Phase 1 | ❌ Create |
| `src/controllers/folder.controller.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/controllers/list.controller.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/controllers/node.controller.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/controllers/tag.controller.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/controllers/daily.controller.ts` | Phase 2+3 | ⚠️ Stub — implement |
| `src/controllers/score.controller.ts` | Phase 3 | ⚠️ Stub — implement |
| `src/controllers/payment.controller.ts` | Phase 5 | ❌ Create |
| `src/controllers/subscription.controller.ts` | Phase 5 | ❌ Create |
| `src/routes/auth.routes.ts` | Phase 1 | ⚠️ Stub — implement |
| `src/routes/otp.routes.ts` | Phase 1 | ❌ Create |
| `src/routes/folder.routes.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/routes/list.routes.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/routes/node.routes.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/routes/tag.routes.ts` | Phase 2 | ⚠️ Stub — implement |
| `src/routes/daily.routes.ts` | Phase 2+3 | ⚠️ Stub — implement |
| `src/routes/score.routes.ts` | Phase 3 | ⚠️ Stub — implement |
| `src/routes/payment.routes.ts` | Phase 5 | ❌ Create |
| `src/routes/subscription.routes.ts` | Phase 5 | ❌ Create |
| `src/jobs/queue.ts` | Phase 4 | ⚠️ Stub — implement |
| `src/jobs/reminder.job.ts` | Phase 4 | ⚠️ Stub — implement |
| `src/jobs/rollover.job.ts` | Phase 4 | ⚠️ Stub — implement |
| `Dockerfile` | Phase 6 | ❌ Create |
| `docker-compose.yml` | Phase 6 | ❌ Create |
| `.github/workflows/deploy.yml` | Phase 6 | ❌ Create |

---

## Complete Environment Variables Reference

```bash
# ── Core ─────────────────────────────────────────────────────────
DATABASE_URL=postgresql://...        # Neon → your project → Connection string
JWT_SECRET=...                       # Min 32 random characters
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development                 # set to "production" on Render

# ── Redis / BullMQ (Phase 4) ─────────────────────────────────────
REDIS_URL=redis://localhost:6379     # local Docker or Upstash URL

# ── CORS (Phase 6) ───────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# ── Payments (Phase 5) ───────────────────────────────────────────
PAYMENT_GATEWAY=razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# ── Email / SMS (Phase 5 stretch) ────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

---

*Execute phases in strict order. Verify each phase before starting the next.
This document is the ground truth — do not invent tables, routes, or functions not listed here.*
