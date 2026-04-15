import { Request, Response, NextFunction } from 'express'
import * as listService from '../services/list.service'

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const lists = await listService.getLists(req.user!.id, String(req.params.folderId))
    res.json(lists)
  } catch (err) {
    next(err)
  }
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await listService.createList(req.user!.id, req.body)
    res.status(201).json(list)
  } catch (err) {
    next(err)
  }
}

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await listService.updateList(req.user!.id, String(req.params.id), req.body)
    res.json(list)
  } catch (err) {
    next(err)
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await listService.deleteList(req.user!.id, String(req.params.id))
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
