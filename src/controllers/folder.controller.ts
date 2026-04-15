import { Request, Response, NextFunction } from 'express'
import * as folderService from '../services/folder.service'

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const folders = await folderService.getFolders(req.user!.id)
    res.json(folders)
  } catch (err) {
    next(err)
  }
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const folder = await folderService.createFolder(req.user!.id, req.body)
    res.status(201).json(folder)
  } catch (err) {
    next(err)
  }
}

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const folder = await folderService.updateFolder(req.user!.id, String(req.params.id), req.body)
    res.json(folder)
  } catch (err) {
    next(err)
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await folderService.deleteFolder(req.user!.id, String(req.params.id))
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
