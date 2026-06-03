import { Request, Response, NextFunction } from 'express'
import {
  createSession,
  getUserSessions,
  getSession,
  deleteSession,
} from '../services/aiSession.service'

/** GET /api/ai/sessions — list all sessions for the authenticated user */
export const listSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessions = await getUserSessions(req.user!.id)
    res.json(sessions)
  } catch (err) {
    next(err)
  }
}

/** POST /api/ai/sessions — create a new empty session */
export const newSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title = 'New Chat' } = req.body as { title?: string }
    const session = await createSession(req.user!.id, title)
    res.status(201).json(session)
  } catch (err) {
    next(err)
  }
}

/** GET /api/ai/sessions/:id — load a session with all messages */
export const loadSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const session = await getSession(req.user!.id, req.params['id'] as string)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    res.json(session)
  } catch (err) {
    next(err)
  }
}

/** DELETE /api/ai/sessions/:id — delete a session */
export const removeSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await deleteSession(req.user!.id, req.params['id'] as string)
    if (!deleted) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
