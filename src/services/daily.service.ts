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
 * Computes and stores the daily score for a user.
 * Scoring: ≥90% → +3, 60–89% → +2, 30–59% → +1, 1–29% → 0, 0% → -1
 * DailyScore rows are append-only — throws if row already exists for this date.
 */
export const computeAndStoreDailyScore = async (userId: string, date: string) => {
  // Immutability guard — once stored, never update
  const existing = await prisma.dailyScore.findFirst({
    where: { userId, listId: null, date },
  })
  if (existing) throw new Error('Score for this date already exists')

  const nodes = await prisma.node.findMany({
    where: { list: { folder: { userId } } },
    select: { status: true },
  })

  const totalTasks = nodes.length
  const doneTasks = nodes.filter((n) => n.status === 'DONE').length
  const pct = totalTasks === 0 ? 0 : (doneTasks / totalTasks) * 100

  let points: number
  if (totalTasks === 0 || pct === 0) {
    points = -1
  } else if (pct < 30) {
    points = 0
  } else if (pct < 60) {
    points = 1
  } else if (pct < 90) {
    points = 2
  } else {
    points = 3
  }

  return prisma.dailyScore.create({
    data: { userId, listId: null, date, totalTasks, doneTasks, points },
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
