import { Request, Response, NextFunction } from 'express'
import * as scoreService from '../services/score.service'

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 30
    const scores = await scoreService.getScores(req.user!.id, limit)
    res.json(scores)
  } catch (err) {
    next(err)
  }
}

export const getStreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const streak = await scoreService.getStreak(req.user!.id)
    res.json(streak)
  } catch (err) {
    next(err)
  }
}
