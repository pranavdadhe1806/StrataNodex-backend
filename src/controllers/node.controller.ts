import { Request, Response, NextFunction } from 'express'
import * as nodeService from '../services/node.service'

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const nodes = await nodeService.getNodes(req.user!.id, String(req.params.listId))
    res.json(nodes)
  } catch (err) {
    next(err)
  }
}

export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const node = await nodeService.getNodeById(req.user!.id, String(req.params.id))
    res.json(node)
  } catch (err) {
    next(err)
  }
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const node = await nodeService.createNode(req.user!.id, req.body)
    res.status(201).json(node)
  } catch (err) {
    next(err)
  }
}

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const node = await nodeService.updateNode(req.user!.id, String(req.params.id), req.body)
    res.json(node)
  } catch (err) {
    next(err)
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await nodeService.deleteNode(req.user!.id, String(req.params.id))
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
