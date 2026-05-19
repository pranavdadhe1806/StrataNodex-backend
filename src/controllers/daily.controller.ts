import { Request, Response, NextFunction } from 'express'
import * as dailyService from '../services/daily.service'
import { rolloverQueue } from '../jobs/queue'

/**
 * GET /api/daily/list
 * Returns (or creates) the user's Daily Task List meta + nodes.
 */
export const getDailyList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await dailyService.getOrCreateDailyList(req.user!.id)
    const nodes = await dailyService.getDailyListNodes(req.user!.id)
    res.json({ list, nodes })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/daily/add/:nodeId
 * Adds an existing node as a daily-ref copy into the Daily Task List.
 */
export const addToDaily = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const node = await dailyService.addToDaily(req.user!.id, String(req.params.nodeId))
    res.status(201).json(node)
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/daily/remove/:nodeId
 * Removes a node from the daily list (accepts daily-copy id or source node id).
 */
export const removeFromDaily = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await dailyService.removeFromDaily(req.user!.id, String(req.params.nodeId))
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

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
 * Enqueues a rollover job — processed asynchronously by rolloverWorker.
 */
export const computeScore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { date, listId } = req.body as { date: string; listId?: string }
    const job = await rolloverQueue.add('rollover', {
      userId: req.user!.id,
      date,
      listId,
    })
    res.status(202).json({ message: 'Score computation queued', jobId: job.id })
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
