# StrataNodex Backend — Audit Report

## Section 1 — Project Structure

**`src/` Directory Tree:**
```text
Folder PATH listing for volume Coding
Volume serial number is FA70-7A8C
D:\PROJECTS\PERSONAL-PROJECTS\STRATANODEX\STRATANODEX-BACKEND\SRC
|   app.ts
|   index.ts
|   
+---config
|       env.ts
|       prisma.ts
|       
+---controllers
|       auth.controller.ts
|       daily.controller.ts
|       folder.controller.ts
|       list.controller.ts
|       node.controller.ts
|       otp.controller.ts
|       score.controller.ts
|       tag.controller.ts
|       
+---jobs
|       queue.ts
|       reminder.job.ts
|       rollover.job.ts
|       
+---middleware
|       auth.middleware.ts
|       errorHandler.ts
|       validate.ts
|       
+---routes
|       auth.routes.ts
|       daily.routes.ts
|       folder.routes.ts
|       list.routes.ts
|       node.routes.ts
|       otp.routes.ts
|       score.routes.ts
|       tag.routes.ts
|       
+---schemas
|       auth.schema.ts
|       folder.schema.ts
|       list.schema.ts
|       node.schema.ts
|       otp.schema.ts
|       tag.schema.ts
|       
+---services
|       auth.service.ts
|       daily.service.ts
|       folder.service.ts
|       list.service.ts
|       node.service.ts
|       otp.service.ts
|       score.service.ts
|       tag.service.ts
|       
+---types
|       express.d.ts
|       
\---utils
        AppError.ts
```

**`prisma/` Directory Tree:**
```text
Folder PATH listing for volume Coding
Volume serial number is FA70-7A8C
D:\PROJECTS\PERSONAL-PROJECTS\STRATANODEX\STRATANODEX-BACKEND\PRISMA
|   schema.prisma
|   
\---migrations
    |   migration_lock.toml
    |   
    \---20260415192340_init
            migration.sql
```

## Section 2 — Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model User {
  id               String           @id @default(cuid())
  email            String           @unique
  phone            String?          @unique // E.164 format e.g. +919876543210
  passwordHash     String? // optional — OTP-only signup has no password
  name             String?
  isEmailVerified  Boolean          @default(false)
  isPhoneVerified  Boolean          @default(false)
  twoFactorEnabled Boolean          @default(false)
  twoFactorMethod  TwoFactorMethod? // null until 2FA is configured
  dayStartTime     String           @default("00:00")
  dayEndTime       String           @default("23:59")
  createdAt        DateTime         @default(now())

  folders      Folder[]
  tags         Tag[]
  dailyScores  DailyScore[]
  otpCodes     OtpCode[]
  subscription Subscription?
  payments     Payment[]
}

model Folder {
  id        String   @id @default(cuid())
  name      String
  userId    String
  position  Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  lists List[]
}

model List {
  id        String   @id @default(cuid())
  name      String
  folderId  String
  position  Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  folder      Folder       @relation(fields: [folderId], references: [id], onDelete: Cascade)
  nodes       Node[]
  tags        Tag[]
  dailyScores DailyScore[]
}

model Node {
  id         String     @id @default(cuid())
  title      String
  status     NodeStatus @default(TODO)
  priority   Priority   @default(MEDIUM)
  notes      String?
  startAt    DateTime?
  endAt      DateTime?
  reminderAt DateTime?
  canvasX    Float?
  canvasY    Float?
  position   Int        @default(0)
  listId     String
  parentId   String?
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  list     List      @relation(fields: [listId], references: [id], onDelete: Cascade)
  parent   Node?     @relation("NodeChildren", fields: [parentId], references: [id])
  children Node[]    @relation("NodeChildren")
  tags     NodeTag[]
}

model Tag {
  id     String  @id @default(cuid())
  name   String
  color  String  @default("#888888")
  userId String
  listId String? // null = global tag | set = local to this list

  user  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  list  List?     @relation(fields: [listId], references: [id], onDelete: Cascade)
  nodes NodeTag[]

  @@unique([userId, listId, name])
}

model NodeTag {
  nodeId String
  tagId  String

  node Node @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([nodeId, tagId])
}

model DailyScore {
  id         String   @id @default(cuid())
  userId     String
  listId     String? // null = overall account score | set = per list score
  date       String // YYYY-MM-DD
  totalTasks Int
  doneTasks  Int
  points     Int
  createdAt  DateTime @default(now())

  user User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  list List? @relation(fields: [listId], references: [id], onDelete: Cascade)

  @@unique([userId, listId, date])
}

enum NodeStatus {
  TODO
  IN_PROGRESS
  DONE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
}

// ─── Auth / OTP ──────────────────────────────────────────────────────────────

model OtpCode {
  id        String     @id @default(cuid())
  userId    String
  code      String // bcrypt-hashed OTP — never store plain text
  type      OtpType
  channel   OtpChannel
  expiresAt DateTime
  usedAt    DateTime? // set when consumed — prevents reuse
  createdAt DateTime   @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum OtpType {
  VERIFY_EMAIL // sent after registration to confirm email
  VERIFY_PHONE // sent after adding phone to confirm ownership
  TWO_FACTOR // sent at login when 2FA is active
  PASSWORD_RESET // sent to allow password reset without login
}

enum OtpChannel {
  EMAIL
  SMS
}

enum TwoFactorMethod {
  EMAIL // OTP via email
  SMS // OTP via SMS
  TOTP // authenticator app (Google Authenticator, Authy)
}

// ─── Payments ────────────────────────────────────────────────────────────────

model Plan {
  id        String       @id @default(cuid())
  name      String       @unique // "Free", "Pro", "Team"
  price     Float // monthly price in base currency unit
  currency  String       @default("USD")
  interval  PlanInterval @default(MONTHLY)
  features  Json // flexible feature flags e.g. {"maxLists": 10}
  isActive  Boolean      @default(true)
  createdAt DateTime     @default(now())

  subscriptions Subscription[]
}

model Subscription {
  id                 String             @id @default(cuid())
  userId             String             @unique // one active plan per user
  planId             String
  status             SubscriptionStatus @default(ACTIVE)
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean            @default(false)
  gatewayCustomerId  String? // e.g. Stripe customer ID — cus_xxx
  gatewaySubId       String? // e.g. Stripe subscription ID — sub_xxx
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan     Plan      @relation(fields: [planId], references: [id])
  payments Payment[]
}

model Payment {
  id               String        @id @default(cuid())
  userId           String
  subscriptionId   String?
  amount           Float
  currency         String        @default("USD")
  status           PaymentStatus @default(PENDING)
  gateway          String // "stripe" | "razorpay" | "paypal"
  gatewayPaymentId String? // e.g. Stripe PaymentIntent ID — pi_xxx
  gatewayOrderId   String? // e.g. Razorpay order ID — order_xxx
  invoiceUrl       String? // link to downloadable invoice PDF
  paidAt           DateTime?
  createdAt        DateTime      @default(now())

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscription Subscription? @relation(fields: [subscriptionId], references: [id])
}

enum PlanInterval {
  MONTHLY
  YEARLY
}

enum SubscriptionStatus {
  TRIALING // free trial period
  ACTIVE // paid and current
  PAST_DUE // payment failed but grace period active
  CANCELLED // user cancelled — access until period end
  EXPIRED // period ended with no renewal
}

enum PaymentStatus {
  PENDING // payment initiated but not confirmed
  PAID // successfully charged
  FAILED // gateway returned failure
  REFUNDED // full or partial refund issued
}
```

## Section 3 — Auth — What Exists

1. **Does a `POST /api/auth/login` endpoint exist?**
   Yes.
   **Route Handler (`src/controllers/auth.controller.ts`):**
   ```typescript
   export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
     try {
       const result = await authService.loginWithPassword(req.body)
       res.json(result)
     } catch (err) {
       next(err)
     }
   }
   ```
   **Service Function (`src/services/auth.service.ts`):**
   ```typescript
   export const loginWithPassword = async (input: { email: string; password: string }) => {
     const user = await prisma.user.findUnique({ where: { email: input.email } })
     if (!user) throw new AppError(401, 'Invalid credentials')
     if (!user.passwordHash) throw new AppError(401, 'This account uses OTP login')

     const valid = await bcrypt.compare(input.password, user.passwordHash)
     if (!valid) throw new AppError(401, 'Invalid credentials')

     if (user.twoFactorEnabled && user.twoFactorMethod) {
       // Map TwoFactorMethod to OtpChannel (TOTP uses EMAIL as fallback in this phase)
       const channel =
         user.twoFactorMethod === TwoFactorMethod.SMS ? OtpChannel.SMS : OtpChannel.EMAIL
       const otp = await otpService.generateOtp(user.id, OtpType.TWO_FACTOR, channel)
       console.log(`[DEV] 2FA OTP for ${user.email}: ${otp}`)
       return { requiresTwoFactor: true, userId: user.id }
     }

     const token = signToken(user.id)
     const { passwordHash: _ph, ...safeUser } = user

     return { user: safeUser, token }
   }
   ```

2. **Does a `POST /api/auth/register` endpoint exist?**
   Yes.
   **Route Handler (`src/controllers/auth.controller.ts`):**
   ```typescript
   export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
     try {
       const result = await authService.registerWithPassword(req.body)
       res.status(201).json(result)
     } catch (err) {
       next(err)
     }
   }
   ```
   **Service Function (`src/services/auth.service.ts`):**
   ```typescript
   export const registerWithPassword = async (input: {
     email: string
     password: string
     name?: string
   }) => {
     const existing = await prisma.user.findUnique({ where: { email: input.email } })
     if (existing) throw new AppError(409, 'Email already in use')

     const passwordHash = await bcrypt.hash(input.password, 12)
     const user = await prisma.user.create({
       data: { email: input.email, passwordHash, name: input.name },
       select: safeUserSelect,
     })

     const otp = await otpService.generateOtp(user.id, OtpType.VERIFY_EMAIL, OtpChannel.EMAIL)
     console.log(`[DEV] Email OTP for ${input.email}: ${otp}`)

     return { user, message: 'Check your email for OTP' }
   }
   ```

3. **Does a `GET /api/auth/me` endpoint exist?**
   Yes.
   ```typescript
   // Route (src/routes/auth.routes.ts)
   router.get('/me', authenticate, authController.me)

   // Controller (src/controllers/auth.controller.ts)
   export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
     try {
       const user = await authService.getMe(req.user!.id)
       res.json(user)
     } catch (err) {
       next(err)
     }
   }
   ```

4. **Is there any 2FA implementation?**
   Yes. 
   **Endpoints:**
   - `POST /api/auth/2fa/enable`
   - `POST /api/auth/2fa/disable`
   - `POST /api/auth/2fa/verify`
   - `POST /api/auth/phone-login/verify` (Handles phone-based login directly)

   **Methods Supported:** `EMAIL`, `SMS`, `TOTP` (These are defined in the Prisma schema under the `TwoFactorMethod` enum. Currently, in `auth.service.ts`, TOTP falls back to `EMAIL` for OTP generation).

5. **What does the login response shape look like?**
   On a successful standard login:
   ```json
   {
     "user": {
       "id": "cuid...",
       "email": "user@example.com",
       "phone": null,
       "name": "John Doe",
       "isEmailVerified": false,
       "isPhoneVerified": false,
       "twoFactorEnabled": false,
       "twoFactorMethod": null,
       "dayStartTime": "00:00",
       "dayEndTime": "23:59",
       "createdAt": "2026-05-02T17:38:29Z"
     },
     "token": "eyJhbGciOiJIUzI1NiIsInR5..."
   }
   ```
   If 2FA is required, the response is:
   ```json
   {
     "requiresTwoFactor": true,
     "userId": "cuid..."
   }
   ```

6. **Is JWT implemented?**
   Yes.
   - **Where is it generated:** In `src/services/auth.service.ts` using the `signToken` helper (`jwt.sign`).
   - **Payload:** `{ userId: string }`
   - **Expiry:** Driven by the `JWT_EXPIRES_IN` environment variable (e.g., `7d` from `.env.example`).

7. **Is there any existing session or device tracking in the DB or code?**
   No. The API relies entirely on stateless JWTs. There is no `Session` table in the database and no device tracking logic implemented in the backend.

## Section 4 — CLI Session Auth — Does Anything Exist?

1. **Any endpoint with "cli" in the name or path:** No.
2. **Any endpoint with "session" in the name or path:** No.
3. **Any model in Prisma schema named `CliSession`, `Session`, `AuthSession`, or similar:** No.
4. **Any polling mechanism or short-lived token system:** No.

## Section 5 — Redis / BullMQ

1. **Is Redis/BullMQ set up?**
   Yes.
   **`src/jobs/queue.ts`:**
   ```typescript
   import { Queue } from 'bullmq'
   import Redis from 'ioredis'
   import { env } from '../config/env'

   // Shared connection for Queue instances (non-blocking — safe to share)
   const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

   connection.on('connect', () => console.log('[Redis] Queue connection established'))
   connection.on('error', (err) => console.error('[Redis] Queue connection error:', err.message))

   export const reminderQueue = new Queue('reminders', { connection })
   export const rolloverQueue = new Queue('rollover', { connection })
   ```

2. **Are there any active jobs defined?**
   Yes. There are two queues defined:
   - `reminders` (`src/jobs/reminder.job.ts` exists in tree)
   - `rollover` (`src/jobs/rollover.job.ts` exists in tree)

3. **Is Redis currently used for anything other than jobs?**
   No. According to the codebase, Redis is only imported and utilized in `src/jobs/queue.ts` for BullMQ queues. It is not currently used as a cache or session store.

## Section 6 — Existing Middleware

1. **Paste `src/middleware/auth.middleware.ts` exactly.**
   ```typescript
   import { Request, Response, NextFunction } from 'express'
   import jwt from 'jsonwebtoken'
   import { env } from '../config/env'

   export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
     const authHeader = req.headers.authorization
     if (!authHeader || !authHeader.startsWith('Bearer ')) {
       res.status(401).json({ error: 'Unauthorized' })
       return
     }

     const token = authHeader.split(' ')[1]
     try {
       const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string }
       req.user = { id: decoded.userId }
       next()
     } catch {
       res.status(401).json({ error: 'Invalid token' })
     }
   }
   ```

2. **Is there any rate limiting middleware?**
   Yes. The `express-rate-limit` package is used in `src/app.ts`:
   ```typescript
   import rateLimit from 'express-rate-limit'

   const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })
   const authLimiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 10,
     message: { error: 'Too many attempts, please try again later' },
   })
   const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 3 })

   app.use('/api', generalLimiter)
   app.use('/api/auth', authLimiter)
   app.use('/api/otp', otpLimiter)
   ```

3. **Is there any request logging?**
   Yes, the `morgan` package is used (`app.use(morgan('dev'))` in `src/app.ts`).

## Section 7 — Environment Variables

**`.env.example`:**
```env
DATABASE_URL=postgresql://user:password@host/dbname
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development

REDIS_URL=redis://localhost:6379

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Section 8 — What Is Missing (your assessment)

Based on the codebase, here is the assessment for the required CLI browser auth flow items:

```text
CLI browser auth flow requires:
- POST /api/auth/cli-session                  (create a short-lived session code): MISSING
- GET  /api/auth/cli-session/:code            (poll for token — CLI calls this every 2s): MISSING
- POST /api/auth/cli-session/:code/complete   (website calls this after login): MISSING
- CliSession model in Prisma                  (id, code, token, expiresAt, used): MISSING
```

## Section 9 — Current Migration State

1. **How many migrations exist in `prisma/migrations/`?**
   There is 1 migration present: `20260415192340_init`.

2. **Is the DB currently in sync with the schema?**
   No, the database is unreachable based on `prisma migrate status` output:
   ```text
   Loaded Prisma config from prisma.config.ts.

   Prisma schema loaded from prisma\schema.prisma.
   Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-muddy-bird-a1lojesi.ap-southeast-1.aws.neon.tech"
   Error: P1001: Can't reach database server at `ep-muddy-bird-a1lojesi.ap-southeast-1.aws.neon.tech:5432`

   Please make sure your database server is running at `ep-muddy-bird-a1lojesi.ap-southeast-1.aws.neon.tech:5432`.
   ```
