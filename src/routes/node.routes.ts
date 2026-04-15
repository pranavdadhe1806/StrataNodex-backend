import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate'
import { createNodeSchema, updateNodeSchema } from '../schemas/node.schema'
import { getAll, getOne, create, update, remove } from '../controllers/node.controller'

const router = Router()
router.use(authenticate)

router.get('/lists/:listId/nodes', getAll)
router.get('/nodes/:id', getOne)
router.post('/nodes', validate(createNodeSchema), create)
router.patch('/nodes/:id', validate(updateNodeSchema), update)
router.delete('/nodes/:id', remove)

export default router
