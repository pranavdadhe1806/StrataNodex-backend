import { Request, Response, NextFunction } from 'express'
import * as dailyService from '../services/daily.service'

export const getToday = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const nodes = await dailyService.getTodayNodes(req.user!.id)
    res.json(nodes)
  } catch (err) {
    next(err)
  }
}

export const getOverdue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const nodes = await dailyService.getOverdueNodes(req.user!.id)
    res.json(nodes)
  } catch (err) {
    next(err)
  }
}

export const computeScore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { date } = req.body as { date: string }
    const score = await dailyService.computeAndStoreDailyScore(req.user!.id, date)
    res.status(201).json(score)
  } catch (err) {
    next(err)
  }
}

export const getScore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const score = await dailyService.getDailyScore(req.user!.id, String(req.params.date))
    if (!score) {
      res.status(404).json({ error: 'Score not found for this date' })
      return
    }
    res.json(score)
  } catch (err) {
    next(err)
  }
}
