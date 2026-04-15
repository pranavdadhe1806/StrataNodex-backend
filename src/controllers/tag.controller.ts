import { Request, Response, NextFunction } from 'express'
import * as tagService from '../services/tag.service'

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tags = await tagService.getTags(req.user!.id)
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
