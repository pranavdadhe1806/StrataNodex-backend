import prisma from '../config/prisma'

export const getScores = async (userId: string, limit = 30) => {
  return prisma.dailyScore.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: limit,
  })
}

export const getStreak = async (userId: string) => {
  const scores = await prisma.dailyScore.findMany({
    where: { userId, points: { gt: 0 } },
    orderBy: { date: 'desc' },
    select: { date: true, points: true },
  })
  return scores
}
