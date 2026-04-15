import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate'
import { createTagSchema, updateTagSchema } from '../schemas/tag.schema'
import { getAll, create, update, remove } from '../controllers/tag.controller'

const router = Router()
router.use(authenticate)

router.get('/', getAll)
router.post('/', validate(createTagSchema), create)
router.patch('/:id', validate(updateTagSchema), update)
router.delete('/:id', remove)

export default router
