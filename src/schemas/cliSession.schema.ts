import { z } from 'zod'

export const completeCliSessionSchema = z.object({
  token: z.string().min(1, 'token is required'),
})
