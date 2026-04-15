import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate'
import { createTagSchema, updateTagSchema } from '../schemas/tag.schema'
import { getAll, create, update, remove } from '../controllers/tag.controller'

const router = Router()
router.use(authenticate)

// GET /api/tags          → global tags only
// GET /api/tags?listId=  → global + list-scoped tags
router.get('/', getAll)
router.post('/', validate(createTagSchema), create)
router.patch('/:id', validate(updateTagSchema), update)
router.delete('/:id', remove)

// Note: attach/detach tag to node is on node routes: POST/DELETE /api/nodes/:id/tags/:tagId

export default router
