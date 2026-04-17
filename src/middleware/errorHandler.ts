import { Request, Response, NextFunction } from 'express'

type HttpError = Error & { statusCode?: number }

export const errorHandler = (err: HttpError, req: Request, res: Response, _next: NextFunction): void => {
  const status = err.statusCode ?? 500
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    // Production: log message only (no stack trace in server logs either)
    console.error(`[ERROR] ${status} ${req.method} ${req.path} — ${err.message}`)
    // 4xx = client errors, safe to expose message; 5xx = server errors, hide internals
    const message = status >= 500 ? 'Internal server error' : err.message
    res.status(status).json({ error: message })
  } else {
    // Development: full stack trace in logs, full message in response
    console.error(err.stack)
    res.status(status).json({ error: err.message || 'Internal server error' })
  }
}
