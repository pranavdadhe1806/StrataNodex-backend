import { z } from 'zod'

export const createNodeSchema = z.object({
  title: z.string().min(1),
  listId: z.string().min(1),
  parentId: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  notes: z.string().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  reminderAt: z.string().datetime().optional(),
  canvasX: z.number().optional(),
  canvasY: z.number().optional(),
  position: z.number().int().optional(),
  tagIds: z.array(z.string()).optional(),
})

export const updateNodeSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  notes: z.string().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  reminderAt: z.string().datetime().optional(),
  canvasX: z.number().optional(),
  canvasY: z.number().optional(),
  position: z.number().int().optional(),
  parentId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
})

export type CreateNodeInput = z.infer<typeof createNodeSchema>
export type UpdateNodeInput = z.infer<typeof updateNodeSchema>
