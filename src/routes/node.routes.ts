import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate'
import { createNodeSchema, createSubNodeSchema, updateNodeSchema, moveNodeSchema } from '../schemas/node.schema'
import { getAll, getOne, create, createChild, update, remove, move } from '../controllers/node.controller'
import { attach, detach } from '../controllers/tag.controller'

const router = Router()
router.use(authenticate)

// List-scoped node tree (root nodes only — children nested inside)
router.get('/lists/:listId/nodes', getAll)

// Get single node by ID
router.get('/nodes/:id', getOne)

// Create root node (listId in body)
router.post('/lists/:listId/nodes', validate(createNodeSchema), create)

// Create sub-node (parentId in URL, listId derived from parent)
router.post('/nodes/:parentId/children', validate(createSubNodeSchema), createChild)

// Update node
router.patch('/nodes/:id', validate(updateNodeSchema), update)

// Delete node (cascades children)
router.delete('/nodes/:id', remove)

// Move node — change parentId/position
router.patch('/nodes/:id/move', validate(moveNodeSchema), move)

// Tag attach/detach — POST /api/nodes/:id/tags/:tagId
router.post('/nodes/:id/tags/:tagId', attach)
router.delete('/nodes/:id/tags/:tagId', detach)

export default router

