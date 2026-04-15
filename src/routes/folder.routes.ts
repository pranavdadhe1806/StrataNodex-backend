import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate'
import { createFolderSchema, updateFolderSchema } from '../schemas/folder.schema'
import { getAll, create, update, remove } from '../controllers/folder.controller'

const router = Router()
router.use(authenticate)

router.get('/', getAll)
router.post('/', validate(createFolderSchema), create)
router.patch('/:id', validate(updateFolderSchema), update)
router.delete('/:id', remove)

export default router
