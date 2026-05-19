import prisma from '../config/prisma'

// ─── Daily System ─────────────────────────────────────────────────────────────

/**
 * Returns the user's Daily Task List, creating the folder+list if they don't
 * exist yet (idempotent — safe to call on every request).
 */
export const getOrCreateDailyList = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { dailyFolderId: true, dailyListId: true },
  })

  if (user.dailyFolderId && user.dailyListId) {
    const list = await prisma.list.findUnique({
      where: { id: user.dailyListId },
      include: { _count: { select: { nodes: true } } },
    })
    if (list) return list
  }

  // Provision: create folder + list + store ids on user
  const folder = await prisma.folder.create({
    data: { name: 'Daily Tasks', userId, position: -1 },
  })
  const list = await prisma.list.create({
    data: { name: 'Daily Task List', folderId: folder.id, position: 0 },
    include: { _count: { select: { nodes: true } } },
  })
  await prisma.user.update({
    where: { id: userId },
    data: { dailyFolderId: folder.id, dailyListId: list.id },
  })
  return list
}

/**
 * Returns all nodes in the daily task list, with source list info for refs.
 */
export const getDailyListNodes = async (userId: string) => {
  const { dailyListId } = await getOrCreateDailyList(userId).then(l =>
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { dailyListId: true } }),
  )
  if (!dailyListId) return []

  return prisma.node.findMany({
    where: { listId: dailyListId },
    orderBy: { position: 'asc' },
    include: {
      tags: { include: { tag: true } },
      source: {
        select: { id: true, title: true, listId: true, list: { select: { id: true, name: true } } },
      },
    },
  })
}

/**
 * Copies a node from another list into the Daily Task List as a linked ref.
 * If a ref already exists for this node today, returns it without duplicating.
 */
export const addToDaily = async (userId: string, sourceNodeId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { dailyListId: true },
  })
  const dailyList = await getOrCreateDailyList(userId)
  const dailyListId = user.dailyListId ?? dailyList.id

  // Guard: source node must belong to this user
  const source = await prisma.node.findFirst({
    where: { id: sourceNodeId, list: { folder: { userId } } },
  })
  if (!source) throw new Error('Node not found')

  // Guard: don't add if already a daily ref
  const existing = await prisma.node.findFirst({
    where: { sourceNodeId, listId: dailyListId },
  })
  if (existing) return existing

  // Get current max position
  const last = await prisma.node.findFirst({
    where: { listId: dailyListId },
    orderBy: { position: 'desc' },
    select: { position: true },
  })

  return prisma.node.create({
    data: {
      title: source.title,
      status: source.status,
      priority: source.priority,
      listId: dailyListId,
      sourceNodeId: source.id,
      position: (last?.position ?? -1) + 1,
    },
    include: {
      tags: { include: { tag: true } },
      source: { select: { id: true, title: true, listId: true, list: { select: { id: true, name: true } } } },
    },
  })
}

/**
 * Removes a node from the daily list (deletes the daily copy, not the original).
 * Can be called with either the daily-copy node id or the original source node id.
 */
export const removeFromDaily = async (userId: string, nodeId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { dailyListId: true },
  })
  if (!user.dailyListId) return

  // nodeId may be the daily copy OR the original
  const dailyNode = await prisma.node.findFirst({
    where: {
      listId: user.dailyListId,
      OR: [{ id: nodeId }, { sourceNodeId: nodeId }],
    },
  })
  if (!dailyNode) throw new Error('Node not in daily list')
  await prisma.node.delete({ where: { id: dailyNode.id } })
}

// ─── Virtual daily views ───────────────────────────────────────────────────────

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
