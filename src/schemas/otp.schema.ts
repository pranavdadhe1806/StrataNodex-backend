import { z } from 'zod'
import { OtpType, OtpChannel } from '@prisma/client'

export const verifyOtpSchema = z.object({
  code: z.string().length(6),
})

export const resendOtpSchema = z.object({
  type: z.nativeEnum(OtpType),
  channel: z.nativeEnum(OtpChannel),
})

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type ResendOtpInput = z.infer<typeof resendOtpSchema>
