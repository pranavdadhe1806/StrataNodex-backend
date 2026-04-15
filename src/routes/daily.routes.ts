import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { computeScore, getScore } from '../controllers/daily.controller'

const router = Router()
router.use(authenticate)

// POST /api/daily/compute — triggers score computation for a given date
router.post('/compute', computeScore)

// GET /api/daily/:date — get score for a specific date (YYYY-MM-DD)
router.get('/:date', getScore)

export default router
