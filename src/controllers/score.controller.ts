import { Request, Response, NextFunction } from 'express'
import * as scoreService from '../services/score.service'

/**
 * GET /api/scores
 * GET /api/scores?listId=xxx
 * GET /api/scores?limit=60
 */
export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 30
    const listId = req.query.listId ? String(req.query.listId) : undefined
    const scores = await scoreService.getScoreHistory(req.user!.id, listId, limit)
    res.json(scores)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/scores/streak
 * Returns { streak: number }
 */
export const getStreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const streak = await scoreService.getCurrentStreak(req.user!.id)
    res.json({ streak })
  } catch (err) {
    next(err)
  }
}
