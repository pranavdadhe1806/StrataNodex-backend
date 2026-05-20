import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate'
import { updatePreferencesSchema } from '../schemas/notification.schema'
import * as ctrl from '../controllers/notification.controller'

const router = Router()
router.use(authenticate)

router.get('/', ctrl.getPreferences)
router.post('/', validate(updatePreferencesSchema), ctrl.updatePreferences)
router.post('/telegram/generate-code', ctrl.generateTelegramCode)
router.delete('/telegram/unlink', ctrl.unlinkTelegram)

export default router
