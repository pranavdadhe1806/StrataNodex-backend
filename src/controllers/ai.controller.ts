import { Request, Response, NextFunction } from 'express'
import { callGemini, AiMessage } from '../services/ai.service'

/**
 * POST /api/ai/chat
 * Body: {
 *   message: string
 *   conversationHistory: AiMessage[]
 *   currentContext?: { folderId?: string; listId?: string }
 * }
 */
export const chatWithAi = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { message, conversationHistory = [], currentContext } = req.body as {
      message: string
      conversationHistory?: AiMessage[]
      currentContext?: { folderId?: string; listId?: string }
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message is required' })
      return
    }

    // Cap conversation history to last 20 messages (10 turns)
    const trimmedHistory = (conversationHistory || []).slice(-20)

    const result = await callGemini(req.user!.id, message.trim(), trimmedHistory)

    res.json(result)
  } catch (err) {
    next(err)
  }
}
