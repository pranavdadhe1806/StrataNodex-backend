import { Request, Response, NextFunction } from 'express'
import * as tagService from '../services/tag.service'

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Optional ?listId= query param for list-scoped + global tags
    const listId = req.query.listId ? String(req.query.listId) : undefined
    const tags = await tagService.getTags(req.user!.id, listId)
    res.json(tags)
  } catch (err) {
    next(err)
  }
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tag = await tagService.createTag(req.user!.id, req.body)
    res.status(201).json(tag)
  } catch (err) {
    next(err)
  }
}

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tag = await tagService.updateTag(req.user!.id, String(req.params.id), req.body)
    res.json(tag)
  } catch (err) {
    next(err)
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await tagService.deleteTag(req.user!.id, String(req.params.id))
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export const attach = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await tagService.attachTag(
      req.user!.id,
      String(req.params.id),
      String(req.params.tagId),
    )
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

export const detach = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await tagService.detachTag(
      req.user!.id,
      String(req.params.id),
      String(req.params.tagId),
    )
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
