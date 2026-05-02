import { Request, Response, NextFunction } from 'express'
import * as cliSessionService from '../services/cliSession.service'

/**
 * POST /api/auth/cli-session
 * Creates a new pending session. CLI calls this first.
 * Returns the code + the URL to open in the browser.
 */
export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, expiresAt } = await cliSessionService.createCliSession()

    // The URL the CLI will open in the browser
    // In dev: http://localhost:5173/auth/cli?session=<code>
    // In prod: https://stratanodex.vercel.app/auth/cli?session=<code>
    const baseUrl = process.env.WEB_APP_URL ?? 'http://localhost:5173'
    const url = `${baseUrl}/auth/cli?session=${code}`

    res.status(201).json({ code, url, expiresAt })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/auth/cli-session/:code
 * CLI polls this every 2 seconds.
 * Returns { pending: true } or { token: string }
 */
export const poll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await cliSessionService.pollCliSession(req.params.code as string)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/cli-session/:code/complete
 * Website calls this after user logs in successfully.
 * Body: { token: string } — the JWT from the normal login flow
 * Protected by x-cli-session-secret header.
 */
export const complete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Verify shared secret — only our website should call this
    const secret = req.headers['x-cli-session-secret']
    if (secret !== process.env.CLI_SESSION_SECRET) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const { token } = req.body
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'token is required' })
      return
    }
    await cliSessionService.completeCliSession(req.params.code as string, token)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
