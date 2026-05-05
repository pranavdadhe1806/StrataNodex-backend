import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as cliSessionController from '../controllers/cliSession.controller'
import { validate } from '../middleware/validate'
import { completeCliSessionSchema } from '../schemas/cliSession.schema'

const router = Router()

// Create: 20 new sessions per 15 min per IP
const cliSessionCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please wait a moment.' },
})

// Poll: 120 per minute — well above the 2s CLI interval
const cliSessionPollLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: { error: 'Too many requests' },
})

// POST /api/auth/cli-session — create session (no auth required)
router.post('/', cliSessionCreateLimiter, cliSessionController.create)

// GET /api/auth/cli-session/:code — poll for token (no auth required)
router.get('/:code', cliSessionPollLimiter, cliSessionController.poll)

// POST /api/auth/cli-session/:code/complete — website completes session
// Protected by x-cli-session-secret header (checked in controller)
router.post('/:code/complete', validate(completeCliSessionSchema), cliSessionController.complete)

export default router
