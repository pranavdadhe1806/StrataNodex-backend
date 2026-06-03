import { Request, Response, NextFunction } from 'express'
import { callGemini, AiMessage } from '../services/ai.service'
import {
  createSession,
  addMessage,
  getSlicedHistory,
} from '../services/aiSession.service'

/**
 * POST /api/ai/chat
 * Body: {
 *   message: string
 *   sessionId?: string          ← if provided, history is loaded from DB
 *   currentContext?: { folderId?: string; listId?: string }
 * }
 */
export const chatWithAi = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { message, sessionId, currentContext } = req.body as {
      message: string
      sessionId?: string
      currentContext?: { folderId?: string; listId?: string }
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message is required' })
      return
    }

    const trimmedMessage = message.trim()

    // Resolve or create session
    let activeSessionId = sessionId
    if (!activeSessionId) {
      const session = await createSession(req.user!.id, trimmedMessage)
      activeSessionId = session.id
    }

    // Load history from DB (sliding window of last 20 messages)
    const dbHistory: AiMessage[] = await getSlicedHistory(activeSessionId!)

    // Call Gemini — pass DB history, NOT frontend-sent history
    const result = await callGemini(req.user!.id, trimmedMessage, dbHistory, currentContext)

    // Persist both messages to DB
    await addMessage(activeSessionId!, 'user', trimmedMessage)

    const assistantContent = result.clarificationNeeded
      ? result.clarificationNeeded
      : [result.confirmation, result.followUpQuestion].filter(Boolean).join('\n\n')

    if (assistantContent) {
      await addMessage(activeSessionId!, 'assistant', assistantContent)
    }

    res.json({ ...result, sessionId: activeSessionId! })
  } catch (err) {
    next(err)
  }
}
