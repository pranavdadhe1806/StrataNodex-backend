import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { chatWithAi } from '../controllers/ai.controller'

const router = Router()
router.use(authenticate)

router.post('/chat', chatWithAi)

export default router
