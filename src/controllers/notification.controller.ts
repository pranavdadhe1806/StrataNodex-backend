import { Request, Response, NextFunction } from 'express'
import * as notificationService from '../services/notification.service'

export const getPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const prefs = await notificationService.getPreferences(req.user!.id)
    res.json(prefs)
  } catch (err) {
    next(err)
  }
}

export const updatePreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const prefs = await notificationService.updatePreferences(req.user!.id, req.body)
    res.json(prefs)
  } catch (err) {
    next(err)
  }
}

export const generateTelegramCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await notificationService.generateTelegramCode(req.user!.id)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const unlinkTelegram = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await notificationService.unlinkTelegram(req.user!.id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
