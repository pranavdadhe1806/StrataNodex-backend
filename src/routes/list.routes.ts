import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate'
import { createListSchema, updateListSchema } from '../schemas/list.schema'
import { getAll, create, update, remove } from '../controllers/list.controller'

const router = Router()
router.use(authenticate)

router.get('/folders/:folderId/lists', getAll)
router.post('/lists', validate(createListSchema), create)
router.patch('/lists/:id', validate(updateListSchema), update)
router.delete('/lists/:id', remove)

export default router
