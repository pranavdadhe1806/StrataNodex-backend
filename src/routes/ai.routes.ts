import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { chatWithAi } from '../controllers/ai.controller'
import { listSessions, newSession, loadSession, removeSession } from '../controllers/aiSession.controller'

const router = Router()
router.use(authenticate)

// Chat
router.post('/chat', chatWithAi)

// Sessions
router.get('/sessions', listSessions)
router.post('/sessions', newSession)
router.get('/sessions/:id', loadSession)
router.delete('/sessions/:id', removeSession)

export default router
