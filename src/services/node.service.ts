import prisma from '../config/prisma'
import { CreateNodeInput, UpdateNodeInput } from '../schemas/node.schema'
import { reminderQueue } from '../jobs/queue'
import { addToDaily, getOrCreateDailyList } from './daily.service'

// ─── Auto-sync helper ─────────────────────────────────────────────────────────

/**
 * If the node's startAt falls on today (server-local date), add it to the
 * user's daily list automatically. Errors are swallowed so they never block
 * the main create/update response.
 */
async function maybeSyncToDaily(userId: string, nodeId: string, startAt?: Date | null): Promise<void> {
  if (!startAt) return
  const start = new Date(startAt)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date();   todayEnd.setHours(23, 59, 59, 999)
  if (start >= todayStart && start <= todayEnd) {
    try {
      const daily = await getOrCreateDailyList(userId)
      // Don't sync if the node IS in the daily list already (avoids recursion)
      const node = await prisma.node.findUnique({ where: { id: nodeId }, select: { listId: true } })
      if (node && node.listId !== daily.id) {
        await addToDaily(userId, nodeId)
      }
    } catch { /* silent — sync failure must not break the main operation */ }
  }
}

// ─── Ownership helpers ────────────────────────────────────────────────────────

const assertListOwnership = async (userId: string, listId: string) => {
  const list = await prisma.list.findFirst({
    where: { id: listId, folder: { userId } },
  })
  if (!list) throw new Error('List not found')
  return list
}

const assertNodeOwnership = async (userId: string, nodeId: string) => {
  const node = await prisma.node.findFirst({
    where: { id: nodeId, list: { folder: { userId } } },
  })
  if (!node) throw new Error('Node not found')
  return node
}

// Full node include — reused in get queries
const nodeInclude = {
  tags: { include: { tag: true } },
  children: {
    orderBy: { position: 'asc' as const },
    include: { tags: { include: { tag: true } } },
  },
} as const

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getNodes = async (userId: string, listId: string) => {
  await assertListOwnership(userId, listId)
  // Return all nodes flat — frontend buildTree reconstructs the hierarchy at any depth
  return prisma.node.findMany({
    where: { listId },
    orderBy: { position: 'asc' },
    include: { tags: { include: { tag: true } } },
  })
}

export const getNodeById = async (userId: string, nodeId: string) => {
  await assertNodeOwnership(userId, nodeId)
  return prisma.node.findUnique({
    where: { id: nodeId },
    include: nodeInclude,
  })
}

// ─── Create ───────────────────────────────────────────────────────────────────

export const createNode = async (userId: string, input: CreateNodeInput) => {
  await assertListOwnership(userId, input.listId)

  // If parentId provided, verify the parent belongs to the same list
  if (input.parentId) {
    const parent = await prisma.node.findFirst({
      where: { id: input.parentId, listId: input.listId },
    })
    if (!parent) throw new Error('Parent node not found in this list')
  }

  const { tagIds, startAt, endAt, reminderAt, ...rest } = input

  const node = await prisma.node.create({
    data: {
      ...rest,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      reminderAt: reminderAt ? new Date(reminderAt) : undefined,
      tags: tagIds ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
    },
    include: nodeInclude,
  })

  if (reminderAt) {
    const delay = new Date(reminderAt).getTime() - Date.now()
    if (delay > 0) {
      await reminderQueue.add(
        'reminder',
        { nodeId: node.id, userId },
        { delay, jobId: `reminder-${node.id}` },
      )
    }
  }

  // Auto-add to daily if startAt is today
  void maybeSyncToDaily(userId, node.id, node.startAt)

  return node
}

// ─── Create sub-node (child) — listId derived from parent ─────────────────────

export const createSubNode = async (userId: string, parentId: string, input: Omit<CreateNodeInput, 'listId' | 'parentId'>) => {
  const parent = await assertNodeOwnership(userId, parentId)

  const { tagIds, startAt, endAt, reminderAt, ...rest } = input

  const node = await prisma.node.create({
    data: {
      ...rest,
      listId: parent.listId,
      parentId,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      reminderAt: reminderAt ? new Date(reminderAt) : undefined,
      tags: tagIds ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
    },
    include: nodeInclude,
  })

  if (reminderAt) {
    const delay = new Date(reminderAt).getTime() - Date.now()
    if (delay > 0) {
      await reminderQueue.add(
        'reminder',
        { nodeId: node.id, userId },
        { delay, jobId: `reminder-${node.id}` },
      )
    }
  }

  // Auto-add to daily if startAt is today
  void maybeSyncToDaily(userId, node.id, node.startAt)

  return node
}

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateNode = async (userId: string, nodeId: string, input: UpdateNodeInput) => {
  await assertNodeOwnership(userId, nodeId)

  const { tagIds, startAt, endAt, reminderAt, ...rest } = input

  const node = await prisma.node.update({
    where: { id: nodeId },
    data: {
      ...rest,
      startAt: startAt !== undefined ? (startAt ? new Date(startAt) : null) : undefined,
      endAt: endAt !== undefined ? (endAt ? new Date(endAt) : null) : undefined,
      reminderAt: reminderAt !== undefined ? (reminderAt ? new Date(reminderAt) : null) : undefined,
      // If tagIds provided: replace all tags atomically
      tags: tagIds
        ? {
            deleteMany: {},
            create: tagIds.map((tagId) => ({ tagId })),
          }
        : undefined,
    },
    include: {
      ...nodeInclude,
      source: { select: { id: true } },
    },
  })

  // ── Status sync ───────────────────────────────────────────────────────────
  if (input.status) {
    // If this is a daily-ref copy, sync status back to the original node
    if (node.sourceNodeId) {
      await prisma.node.update({
        where: { id: node.sourceNodeId },
        data: { status: input.status },
      })
    }
    // Sync status forward to any daily-ref copies of this node
    await prisma.node.updateMany({
      where: { sourceNodeId: nodeId },
      data: { status: input.status },
    })
  }

  if (reminderAt) {
    const delay = new Date(reminderAt).getTime() - Date.now()
    if (delay > 0) {
      await reminderQueue.add(
        'reminder',
        { nodeId, userId },
        { delay, jobId: `reminder-${nodeId}` },
      )
    }
  }

  // Auto-add to daily if startAt is set to today
  void maybeSyncToDaily(userId, node.id, node.startAt)

  return node
}

// ─── Delete ───────────────────────────────────────────────────────────────────

// IMPORTANT: The schema uses ON DELETE SET NULL (not CASCADE) on the self-referential
// parentId FK. Deleting a parent node directly would null-out its children's parentId,
// making them appear as orphaned root-level nodes in the UI.
// We must delete the subtree recursively (children first, then the parent).
async function deleteSubtree(nodeId: string): Promise<void> {
  const children = await prisma.node.findMany({
    where: { parentId: nodeId },
    select: { id: true },
  })
  // Recurse into children first so leaves are deleted before their parents
  for (const child of children) {
    await deleteSubtree(child.id)
  }
  await prisma.node.delete({ where: { id: nodeId } })
}

export const deleteNode = async (userId: string, nodeId: string) => {
  await assertNodeOwnership(userId, nodeId)
  return deleteSubtree(nodeId)
}

// ─── Move (reparent + reposition) ─────────────────────────────────────────────

export const moveNode = async (
  userId: string,
  nodeId: string,
  input: { parentId: string | null; position: number },
) => {
  const node = await assertNodeOwnership(userId, nodeId)

  // If moving to a new parent, verify the parent is in the same list
  if (input.parentId) {
    const newParent = await prisma.node.findFirst({
      where: { id: input.parentId, listId: node.listId },
    })
    if (!newParent) throw new Error('Target parent node not found in this list')
  }

  return prisma.node.update({
    where: { id: nodeId },
    data: { parentId: input.parentId, position: input.position },
    include: nodeInclude,
  })
}
