import crypto from 'crypto'
import prisma from '../config/prisma'
import type { UpdatePreferencesInput } from '../schemas/notification.schema'

export const getPreferences = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      telegramEnabled: true,
      telegramChatId: true,
      emailNotifEnabled: true,
      emailNotifAddress: true,
      reminderTime: true,
      reminderTimezone: true,
    },
  })

  return {
    telegramEnabled: user.telegramEnabled,
    telegramLinked: !!user.telegramChatId,
    emailNotifEnabled: user.emailNotifEnabled,
    emailNotifAddress: user.emailNotifAddress ?? '',
    reminderTime: user.reminderTime,
    reminderTimezone: user.reminderTimezone,
  }
}

export const updatePreferences = async (userId: string, data: UpdatePreferencesInput) => {
  const updateData: Record<string, unknown> = {}
  if (data.telegramEnabled !== undefined) updateData.telegramEnabled = data.telegramEnabled
  if (data.emailNotifEnabled !== undefined) updateData.emailNotifEnabled = data.emailNotifEnabled
  if (data.emailNotifAddress !== undefined) updateData.emailNotifAddress = data.emailNotifAddress
  if (data.reminderTime !== undefined) updateData.reminderTime = data.reminderTime
  if (data.reminderTimezone !== undefined) updateData.reminderTimezone = data.reminderTimezone

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      telegramEnabled: true,
      telegramChatId: true,
      emailNotifEnabled: true,
      emailNotifAddress: true,
      reminderTime: true,
      reminderTimezone: true,
    },
  })

  return {
    telegramEnabled: user.telegramEnabled,
    telegramLinked: !!user.telegramChatId,
    emailNotifEnabled: user.emailNotifEnabled,
    emailNotifAddress: user.emailNotifAddress ?? '',
    reminderTime: user.reminderTime,
    reminderTimezone: user.reminderTimezone,
  }
}

export const generateTelegramCode = async (userId: string) => {
  const code = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6)
  const expiry = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramLinkCode: code,
      telegramLinkExpiry: expiry,
    },
  })

  return { code }
}

export const unlinkTelegram = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramChatId: null,
      telegramEnabled: false,
      telegramLinkCode: null,
      telegramLinkExpiry: null,
    },
  })
}
