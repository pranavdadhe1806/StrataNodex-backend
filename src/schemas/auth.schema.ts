import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export const phoneOtpRequestSchema = z.object({
  // E.164 format: +<country code><number>, e.g. +919876543210
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format e.g. +919876543210'),
})

export const phoneOtpVerifySchema = z.object({
  phone: z.string(),
  code: z.string().length(6),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(8),
})

export const enable2FASchema = z.object({
  method: z.enum(['EMAIL', 'SMS', 'TOTP']),
})

export const verify2FASchema = z.object({
  userId: z.string(),
  code: z.string().length(6),
})

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type PhoneOtpRequestInput = z.infer<typeof phoneOtpRequestSchema>
export type PhoneOtpVerifyInput = z.infer<typeof phoneOtpVerifySchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type Enable2FAInput = z.infer<typeof enable2FASchema>
export type Verify2FAInput = z.infer<typeof verify2FASchema>
