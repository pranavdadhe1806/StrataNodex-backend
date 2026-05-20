import { z } from 'zod'

export const updatePreferencesSchema = z.object({
  telegramEnabled: z.boolean().optional(),
  emailNotifEnabled: z.boolean().optional(),
  emailNotifAddress: z.string().email().optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
  reminderTimezone: z.string().optional(),
})

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>
