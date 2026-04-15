import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { getAll, getStreak } from '../controllers/score.controller'

const router = Router()
router.use(authenticate)

router.get('/', getAll)
router.get('/streak', getStreak)

export default router
