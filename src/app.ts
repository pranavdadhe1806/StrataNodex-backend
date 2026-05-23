import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { errorHandler } from './middleware/errorHandler'
import { env } from './config/env'

import authRoutes from './routes/auth.routes'
import otpRoutes from './routes/otp.routes'
import folderRoutes from './routes/folder.routes'
import listRoutes from './routes/list.routes'
import nodeRoutes from './routes/node.routes'
import tagRoutes from './routes/tag.routes'
import dailyRoutes from './routes/daily.routes'
import scoreRoutes from './routes/score.routes'
import cliSessionRoutes from './routes/cliSession.routes'
import notificationRoutes from './routes/notification.routes'

const app = express()

app.set('trust proxy', 1)

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet())
// Custom domains that are always allowed regardless of ALLOWED_ORIGINS env var
const CUSTOM_DOMAINS = [
  'https://stratanodex.online',
  'https://www.stratanodex.online',
  'https://app.stratanodex.online',
  'https://api.stratanodex.online',
]

app.use(cors({
  origin: function (origin, callback) {
    const allowed = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    if (
      !origin ||
      allowed.includes(origin) ||
      CUSTOM_DOMAINS.includes(origin) ||
      /\.vercel\.app$/.test(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-cli-session-secret'],
}))
app.use(morgan('dev'))
app.use(express.json())

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  skip: (req) => req.path.startsWith('/auth/cli-session'), // req.path is relative to /api mount
})
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: (req) => {
    // Only rate-limit actual auth mutation endpoints (login, register, 2fa, password reset).
    // Skip /me (token validation) and cli-session — these are called on every startup.
    const path = req.path
    return (
      path.startsWith('/cli-session') ||
      path === '/me' ||
      path.startsWith('/verify-email') ||
      path.startsWith('/verify-phone') ||
      path.startsWith('/resend-otp')
    )
  },
  message: { error: 'Too many attempts, please try again later' },
})
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 3 })

app.use('/api', generalLimiter)
// CLI session rate limiters are applied directly in cliSession.routes.ts
app.use('/api/auth', authLimiter)
app.use('/api/otp', otpLimiter)

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth/cli-session', cliSessionRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/otp', otpRoutes)
app.use('/api/folders', folderRoutes)
app.use('/api', listRoutes)
app.use('/api', nodeRoutes)
app.use('/api/tags', tagRoutes)
app.use('/api/daily', dailyRoutes)
app.use('/api/scores', scoreRoutes)
app.use('/api/notifications', notificationRoutes)

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(errorHandler)

export default app
