import { z } from 'zod'

export const createFolderSchema = z.object({
  name: z.string().min(1),
  position: z.number().int().optional(),
})

export const updateFolderSchema = z.object({
  name: z.string().min(1).optional(),
  position: z.number().int().optional(),
})

export type CreateFolderInput = z.infer<typeof createFolderSchema>
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>
