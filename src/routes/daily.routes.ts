import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { getToday, getOverdue, computeScore, getScore } from '../controllers/daily.controller'

const router = Router()
router.use(authenticate)

// Virtual daily task views
router.get('/today', getToday)
router.get('/overdue', getOverdue)

// Gamification: score for a specific date
router.post('/compute', computeScore)
router.get('/:date', getScore)

export default router
