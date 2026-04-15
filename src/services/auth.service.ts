import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { OtpType, OtpChannel, TwoFactorMethod } from '@prisma/client'
import prisma from '../config/prisma'
import { env } from '../config/env'
import * as otpService from './otp.service'

// Helper — build JWT with correct options despite strict type quirks in @types/jsonwebtoken
const signToken = (userId: string): string =>
  jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as unknown as import('jsonwebtoken').SignOptions)

// Safe user select — never returns passwordHash
const safeUserSelect = {
  id: true,
  email: true,
  phone: true,
  name: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  twoFactorEnabled: true,
  twoFactorMethod: true,
  dayStartTime: true,
  dayEndTime: true,
  createdAt: true,
}

// ─── Register ────────────────────────────────────────────────────────────────

export const registerWithPassword = async (input: {
  email: string
  password: string
  name?: string
}) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) throw new Error('Email already in use')

  const passwordHash = await bcrypt.hash(input.password, 12)
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash, name: input.name },
    select: safeUserSelect,
  })

  const otp = await otpService.generateOtp(user.id, OtpType.VERIFY_EMAIL, OtpChannel.EMAIL)
  console.log(`[DEV] Email OTP for ${input.email}: ${otp}`)

  return { user, message: 'Check your email for OTP' }
}

// ─── Login ───────────────────────────────────────────────────────────────────

export const loginWithPassword = async (input: { email: string; password: string }) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) throw new Error('Invalid credentials')
  if (!user.passwordHash) throw new Error('This account uses OTP login')

  const valid = await bcrypt.compare(input.password, user.passwordHash)
  if (!valid) throw new Error('Invalid credentials')

  if (user.twoFactorEnabled && user.twoFactorMethod) {
    // Map TwoFactorMethod to OtpChannel (TOTP uses EMAIL as fallback in this phase)
    const channel =
      user.twoFactorMethod === TwoFactorMethod.SMS ? OtpChannel.SMS : OtpChannel.EMAIL
    const otp = await otpService.generateOtp(user.id, OtpType.TWO_FACTOR, channel)
    console.log(`[DEV] 2FA OTP for ${user.email}: ${otp}`)
    return { requiresTwoFactor: true, userId: user.id }
  }

  const token = signToken(user.id)
  const { passwordHash: _ph, ...safeUser } = user

  return { user: safeUser, token }
}

// ─── Get Current User ─────────────────────────────────────────────────────────

export const getMe = async (userId: string) => {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: safeUserSelect,
  })
}

// ─── Phone OTP Login ──────────────────────────────────────────────────────────

export const requestPhoneOtp = async (phone: string) => {
  const user = await prisma.user.findUnique({ where: { phone } })
  if (!user) throw new Error('No account found with this number')

  const otp = await otpService.generateOtp(user.id, OtpType.TWO_FACTOR, OtpChannel.SMS)
  console.log(`[DEV] Phone OTP for ${phone}: ${otp}`)

  return { message: 'OTP sent to your phone' }
}

export const verifyPhoneLogin = async (input: { phone: string; code: string }) => {
  const user = await prisma.user.findUnique({ where: { phone: input.phone } })
  if (!user) throw new Error('No account found with this number')

  await otpService.verifyOtp(user.id, input.code, OtpType.TWO_FACTOR)

  const token = signToken(user.id)
  const { passwordHash: _ph, ...safeUser } = user

  return { user: safeUser, token }
}

// ─── Password Reset ───────────────────────────────────────────────────────────

export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } })

  // Silent return — don't leak whether the email exists
  if (user) {
    const otp = await otpService.generateOtp(user.id, OtpType.PASSWORD_RESET, OtpChannel.EMAIL)
    console.log(`[DEV] Password reset OTP for ${email}: ${otp}`)
  }

  return { message: 'If the email exists, you will receive an OTP' }
}

export const resetPassword = async (input: {
  email: string
  code: string
  newPassword: string
}) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) throw new Error('Invalid request')

  await otpService.verifyOtp(user.id, input.code, OtpType.PASSWORD_RESET)

  const passwordHash = await bcrypt.hash(input.newPassword, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  return { message: 'Password reset successful' }
}

// ─── 2FA Management ──────────────────────────────────────────────────────────

export const enable2FA = async (userId: string, method: TwoFactorMethod) => {
  return prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true, twoFactorMethod: method },
    select: safeUserSelect,
  })
}

export const disable2FA = async (userId: string) => {
  return prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorMethod: null },
    select: safeUserSelect,
  })
}

export const verify2FA = async (input: { userId: string; code: string }) => {
  await otpService.verifyOtp(input.userId, input.code, OtpType.TWO_FACTOR)

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: safeUserSelect,
  })

  const token = signToken(user.id)
  return { user, token }
}

// ─── OTP Verification (for email/phone confirm) ───────────────────────────────

export const verifyEmailOtp = async (userId: string, code: string) => {
  await otpService.verifyOtp(userId, code, OtpType.VERIFY_EMAIL)
  await otpService.markEmailVerified(userId)
  return { message: 'Email verified successfully' }
}

export const verifyPhoneOtp = async (userId: string, code: string) => {
  await otpService.verifyOtp(userId, code, OtpType.VERIFY_PHONE)
  await otpService.markPhoneVerified(userId)
  return { message: 'Phone verified successfully' }
}

export const resendOtp = async (userId: string, type: OtpType, channel: OtpChannel) => {
  const otp = await otpService.generateOtp(userId, type, channel)
  console.log(`[DEV] Resent OTP (${type} via ${channel}): ${otp}`)
  return { message: 'OTP resent' }
}
