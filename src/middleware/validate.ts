import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() })
    return
  }
  req.body = result.data
  next()
}
