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
 * Auto-adds any root-level node whose startAt date is today into the Daily Task List.
 * Skips nodes already in the daily list (addToDaily is idempotent).
 * Called automatically when the daily list is fetched — no cron needed.
 */
const syncTodayNodes = async (userId: string, dailyListId: string) => {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // Find all top-level nodes (in any of the user's lists, excluding the daily list itself)
  // whose startAt falls on today and haven't been copied yet
  const todayNodes = await prisma.node.findMany({
    where: {
      parentId: null,
      startAt: { gte: todayStart, lte: todayEnd },
      list: { folder: { userId } },
      listId: { not: dailyListId },
    },
    select: { id: true },
  })

  // Get set of sourceNodeIds already in daily to avoid duplicate API calls
  const alreadyInDaily = await prisma.node.findMany({
    where: { listId: dailyListId, sourceNodeId: { not: null } },
    select: { sourceNodeId: true },
  })
  const alreadySet = new Set(alreadyInDaily.map(n => n.sourceNodeId))

  const nodesToAdd = todayNodes.filter(n => !alreadySet.has(n.id))
  for (const node of nodesToAdd) {
    await addToDaily(userId, node.id).catch(() => {/* ignore individual failures */})
  }
}

/**
 * Returns all root-level nodes in the daily task list, with children nested recursively.
 * Also auto-syncs any nodes whose startAt is today before returning.
 */
export const getDailyListNodes = async (userId: string) => {
  const { dailyListId } = await getOrCreateDailyList(userId).then(l =>
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { dailyListId: true } }),
  )
  if (!dailyListId) return []

  // Auto-add any nodes scheduled for today
  await syncTodayNodes(userId, dailyListId)

  return prisma.node.findMany({
    where: { listId: dailyListId, parentId: null },
    orderBy: { position: 'asc' },
    include: {
      tags: { include: { tag: true } },
      source: {
        select: { id: true, title: true, listId: true, list: { select: { id: true, name: true } } },
      },
      children: {
        orderBy: { position: 'asc' },
        include: {
          tags: { include: { tag: true } },
          source: { select: { id: true, title: true, listId: true, list: { select: { id: true, name: true } } } },
          children: {
            orderBy: { position: 'asc' },
            include: {
              tags: { include: { tag: true } },
              source: { select: { id: true, title: true, listId: true, list: { select: { id: true, name: true } } } },
              children: {
                orderBy: { position: 'asc' },
                include: {
                  tags: { include: { tag: true } },
                  source: { select: { id: true, title: true, listId: true, list: { select: { id: true, name: true } } } },
                },
              },
            },
          },
        },
      },
    },
  })
}

/**
 * Copies a node AND its entire subtree from another list into the Daily Task List.
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
    include: { tags: { include: { tag: true } } },
  })
  if (!source) throw new Error('Node not found')

  // Guard: don't add if already a daily ref
  const existing = await prisma.node.findFirst({
    where: { sourceNodeId, listId: dailyListId },
  })
  if (existing) return existing

  // Get current max position for new root-level entries
  const last = await prisma.node.findFirst({
    where: { listId: dailyListId, parentId: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  const rootPosition = (last?.position ?? -1) + 1

  // Recursively copy the node and all its descendants
  const copySubtree = async (
    srcNodeId: string,
    parentDailyId: string | null,
    position: number,
  ): Promise<void> => {
    const srcNode = await prisma.node.findUnique({
      where: { id: srcNodeId },
      include: { children: { orderBy: { position: 'asc' } } },
    })
    if (!srcNode) return

    const dailyCopy = await prisma.node.create({
      data: {
        title: srcNode.title,
        status: srcNode.status,
        priority: srcNode.priority,
        listId: dailyListId,
        parentId: parentDailyId,
        sourceNodeId: srcNode.id,
        position,
      },
    })

    // Recursively copy children
    for (let i = 0; i < srcNode.children.length; i++) {
      await copySubtree(srcNode.children[i].id, dailyCopy.id, i)
    }
  }

  await copySubtree(sourceNodeId, null, rootPosition)

  // Return the root daily copy with full include
  return prisma.node.findFirst({
    where: { sourceNodeId, listId: dailyListId },
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
