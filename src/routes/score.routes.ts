import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { getAll, getStreak, getSummary } from '../controllers/score.controller'

const router = Router()
router.use(authenticate)

router.get('/summary', getSummary)
router.get('/streak', getStreak)
router.get('/', getAll)

export default router
