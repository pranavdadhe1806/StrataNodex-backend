import prisma from '../config/prisma'

/**
 * Computes the daily score for a user based on task completion.
 * Scoring: ≥90% → +3, 60–89% → +2, 30–59% → +1, 1–29% → 0, 0% → -1
 * DailyScore rows are append-only — never updated.
 */
export const computeAndStoreDailyScore = async (userId: string, date: string) => {
  // Check if score for this date already exists (immutable)
  const existing = await prisma.dailyScore.findFirst({
    where: { userId, listId: null, date },
  })
  if (existing) throw new Error('Score for this date already exists')

  // Fetch all nodes for this user
  const nodes = await prisma.node.findMany({
    where: { list: { folder: { userId } } },
    select: { status: true },
  })

  const totalTasks = nodes.length
  const doneTasks = nodes.filter((n: { status: string }) => n.status === 'DONE').length
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
    data: { userId, date, totalTasks, doneTasks, points },
  })
}

export const getDailyScore = async (userId: string, date: string) => {
  return prisma.dailyScore.findFirst({
    where: { userId, listId: null, date },
  })
}
