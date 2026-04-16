import { Request, Response, NextFunction } from 'express'

type HttpError = Error & { statusCode?: number }

export const errorHandler = (err: HttpError, req: Request, res: Response, _next: NextFunction): void => {
  console.error(err.stack)
  const status = err.statusCode ?? 500
  res.status(status).json({ error: err.message || 'Internal server error' })
}
