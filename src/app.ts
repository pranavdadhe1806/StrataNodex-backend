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

const app = express()

app.set('trust proxy', 1)

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: env.ALLOWED_ORIGINS.split(','),
  credentials: true,
}))
app.use(morgan('dev'))
app.use(express.json())

// ─── Rate Limiting ────────────────────────────────────────────────────────────
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

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/otp', otpRoutes)
app.use('/api/folders', folderRoutes)
app.use('/api', listRoutes)
app.use('/api', nodeRoutes)
app.use('/api/tags', tagRoutes)
app.use('/api/daily', dailyRoutes)
app.use('/api/scores', scoreRoutes)

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(errorHandler)

export default app
