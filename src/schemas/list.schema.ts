import { z } from 'zod'

export const createListSchema = z.object({
  name: z.string().min(1),
  folderId: z.string().min(1),
  position: z.number().int().optional(),
})

export const updateListSchema = z.object({
  name: z.string().min(1).optional(),
  position: z.number().int().optional(),
})

export type CreateListInput = z.infer<typeof createListSchema>
export type UpdateListInput = z.infer<typeof updateListSchema>
