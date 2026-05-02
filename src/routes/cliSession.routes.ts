import { Router } from 'express'
import * as cliSessionController from '../controllers/cliSession.controller'
import { validate } from '../middleware/validate'
import { completeCliSessionSchema } from '../schemas/cliSession.schema'

const router = Router()

// POST /api/auth/cli-session — create session (no auth required)
router.post('/', cliSessionController.create)

// GET /api/auth/cli-session/:code — poll for token (no auth required)
router.get('/:code', cliSessionController.poll)

// POST /api/auth/cli-session/:code/complete — website completes session
// Protected by x-cli-session-secret header (checked in controller)
router.post('/:code/complete', validate(completeCliSessionSchema), cliSessionController.complete)

export default router
