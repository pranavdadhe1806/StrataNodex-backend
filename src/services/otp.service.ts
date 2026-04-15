import bcrypt from 'bcrypt'
import { OtpType, OtpChannel } from '@prisma/client'
import prisma from '../config/prisma'

/**
 * Generates a 6-digit OTP, hashes it, stores in DB, and returns the plain code.
 * Deletes any previous unused OTP of the same userId+type before creating a new one.
 */
export const generateOtp = async (
  userId: string,
  type: OtpType,
  channel: OtpChannel,
): Promise<string> => {
  const plain = Math.floor(100000 + Math.random() * 900000).toString()
  const hashed = await bcrypt.hash(plain, 10)

  // Delete any previous unused OTP for same user + type to prevent accumulation
  await prisma.otpCode.deleteMany({
    where: { userId, type, usedAt: null },
  })

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

  await prisma.otpCode.create({
    data: { userId, code: hashed, type, channel, expiresAt },
  })

  return plain
}

/**
 * Verifies a submitted plain OTP against the stored hashed version.
 * Stamps usedAt on success to prevent reuse.
 */
export const verifyOtp = async (
  userId: string,
  plainCode: string,
  type: OtpType,
): Promise<void> => {
  const record = await prisma.otpCode.findFirst({
    where: { userId, type, usedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) throw new Error('OTP not found or already used')
  if (record.expiresAt < new Date()) throw new Error('OTP has expired')

  const isValid = await bcrypt.compare(plainCode, record.code)
  if (!isValid) throw new Error('Invalid OTP')

  // Stamp as used — prevents reuse
  await prisma.otpCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  })
}

export const markEmailVerified = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: { isEmailVerified: true },
  })
}

export const markPhoneVerified = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: { isPhoneVerified: true },
  })
}
