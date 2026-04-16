import { Request, Response, NextFunction } from 'express'
import * as dailyService from '../services/daily.service'
import * as scoreService from '../services/score.service'

/**
 * GET /api/daily/today
 * Returns non-DONE nodes whose date range overlaps with today.
 */
export const getToday = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const nodes = await dailyService.getTodayNodes(req.user!.id)
    res.json(nodes)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/daily/overdue
 * Returns non-DONE nodes whose endAt is before today.
 */
export const getOverdue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const nodes = await dailyService.getOverdueNodes(req.user!.id)
    res.json(nodes)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/daily/compute
 * Body: { date: 'YYYY-MM-DD', listId?: string }
 * Computes and stores the daily score. Append-only — 409 if already exists.
 */
export const computeScore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { date, listId } = req.body as { date: string; listId?: string }
    const score = await scoreService.computeAndStoreDailyScore(req.user!.id, date, listId)
    res.status(201).json(score)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/daily/:date
 * Returns the stored score row for a specific date (YYYY-MM-DD).
 */
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
