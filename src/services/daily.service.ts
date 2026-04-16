import prisma from '../config/prisma'

/**
 * Returns all non-DONE nodes that overlap with today's date range.
 * A node is "today" if: startAt <= today_end AND endAt >= today_start
 */
export const getTodayNodes = async (userId: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  return prisma.node.findMany({
    where: {
      list: { folder: { userId } },
      status: { not: 'DONE' },
      AND: [
        { startAt: { lte: tomorrow } },
        { endAt: { gte: today } },
      ],
    },
    orderBy: { priority: 'desc' },
    include: {
      tags: { include: { tag: true } },
      list: { select: { id: true, name: true } },
    },
  })
}

/**
 * Returns all non-DONE nodes whose endAt is in the past.
 */
export const getOverdueNodes = async (userId: string) => {
  const now = new Date()
  now.setHours(0, 0, 0, 0) // Start of today

  return prisma.node.findMany({
    where: {
      list: { folder: { userId } },
      status: { not: 'DONE' },
      endAt: { lt: now },
    },
    orderBy: { endAt: 'asc' }, // Oldest overdue first
    include: {
      tags: { include: { tag: true } },
      list: { select: { id: true, name: true } },
    },
  })
}

/**
 * Retrieves the stored daily score for one specific date.
 */
export const getDailyScore = async (userId: string, date: string) => {
  return prisma.dailyScore.findFirst({
    where: { userId, listId: null, date },
  })
}
