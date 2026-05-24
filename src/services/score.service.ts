import prisma from '../config/prisma'

// ─── 3B: Live Summary ────────────────────────────────────────────────────────

/**
 * Returns a live snapshot of completion stats for every folder and list.
 * Not stored — computed on the fly from current node states.
 */
export const getScoreSummary = async (userId: string) => {
  const folders = await prisma.folder.findMany({
    where: { userId },
    include: {
      lists: {
        include: { nodes: { select: { status: true } } },
        orderBy: { position: 'asc' },
      },
    },
    orderBy: { position: 'asc' },
  })

  return folders.map((folder) => {
    const lists = folder.lists.map((list) => {
      const total = list.nodes.length
      const done = list.nodes.filter((n) => n.status === 'DONE').length
      const inProgress = list.nodes.filter((n) => n.status === 'IN_PROGRESS').length
      return {
        id: list.id,
        name: list.name,
        totalTasks: total,
        doneTasks: done,
        inProgressTasks: inProgress,
        completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
      }
    })

    const totalTasks = lists.reduce((s, l) => s + l.totalTasks, 0)
    const doneTasks = lists.reduce((s, l) => s + l.doneTasks, 0)

    return {
      id: folder.id,
      name: folder.name,
      totalTasks,
      doneTasks,
      completionPct: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      lists,
    }
  })
}

// ─── Scoring formula (from PLAN.md) ──────────────────────────────────────────
//   ≥ 90% done  → +3
//   60–89%      → +2
//   30–59%      → +1
//   1–29%       →  0
//   0%          → -1

function calcPoints(totalTasks: number, doneTasks: number): number {
  if (totalTasks === 0) return -1
  const pct = (doneTasks / totalTasks) * 100
  if (pct === 0) return -1
  if (pct < 30) return 0
  if (pct < 60) return 1
  if (pct < 90) return 2
  return 3
}

// ─── 3A: Compute & Store ─────────────────────────────────────────────────────

/**
 * Computes and stores the daily score for a user (overall or per-list).
 * DailyScore rows are append-only — throws 409 if row already exists.
 */
export const computeAndStoreDailyScore = async (
  userId: string,
  date: string,
  listId?: string,
) => {
  // Immutability guard — once stored for this [userId, listId, date], never recompute
  const existing = await prisma.dailyScore.findFirst({
    where: { userId, listId: listId ?? null, date },
  })
  if (existing) {
    const err = new Error('Score for this date already exists') as Error & { statusCode: number }
    err.statusCode = 409
    throw err
  }

  // For overall score (no listId), scope to the user's Daily Task List
  let resolvedListId = listId
  if (!resolvedListId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { dailyListId: true } })
    resolvedListId = user?.dailyListId ?? undefined
  }

  const where = resolvedListId
    ? { listId: resolvedListId, list: { folder: { userId } } }
    : { list: { folder: { userId } } }

  const nodes = await prisma.node.findMany({
    where,
    select: { status: true },
  })

  const totalTasks = nodes.length
  const doneTasks = nodes.filter((n) => n.status === 'DONE').length
  const points = calcPoints(totalTasks, doneTasks)

  return prisma.dailyScore.create({
    data: {
      userId,
      listId: listId ?? null,
      date,
      totalTasks,
      doneTasks,
      points,
    },
  })
}

// ─── 3A: Score History ────────────────────────────────────────────────────────

/**
 * Returns score history for the user, optionally filtered by list.
 * Default: last 30 days, overall scores (listId=null).
 */
export const getScoreHistory = async (
  userId: string,
  listId?: string,
  limit = 30,
) => {
  return prisma.dailyScore.findMany({
    where: {
      userId,
      listId: listId ?? null,
    },
    orderBy: { date: 'desc' },
    take: limit,
  })
}

// ─── 3A: Streak Calculation ───────────────────────────────────────────────────

/**
 * Returns a YYYY-MM-DD string in the server's LOCAL timezone.
 * Do NOT use toISOString() — it returns UTC which is off by the timezone offset
 * (e.g. IST midnight = UTC 18:30 the previous day → wrong date string).
 */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Computes the current consecutive-day streak for a user (overall scores only).
 * A day counts towards the streak only if points > 0.
 * The streak breaks as soon as a day has points <= 0 OR a date is missing.
 */
export const getCurrentStreak = async (userId: string): Promise<number> => {
  // Fetch all overall scores ordered newest first
  const scores = await prisma.dailyScore.findMany({
    where: { userId, listId: null },
    orderBy: { date: 'desc' },
    select: { date: true, points: true },
  })

  if (scores.length === 0) return 0

  let streak = 0

  // Build a Set of dates where the user scored > 0
  const positiveDateSet = new Set(
    scores.filter((s) => s.points > 0).map((s) => s.date),
  )

  // Start from today in local time and walk backwards
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (true) {
    const dateStr = toLocalDateStr(cursor)
    if (positiveDateSet.has(dateStr)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      // Grace: if today has no score yet (score computed later in the day),
      // allow the streak to still count from yesterday
      if (streak === 0) {
        cursor.setDate(cursor.getDate() - 1)
        const yesterdayStr = toLocalDateStr(cursor)
        if (positiveDateSet.has(yesterdayStr)) {
          streak++
          cursor.setDate(cursor.getDate() - 1)
          continue
        }
      }
      break
    }
  }

  return streak
}

