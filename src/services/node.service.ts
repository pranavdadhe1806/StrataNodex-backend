import prisma from '../config/prisma'
import { CreateNodeInput, UpdateNodeInput } from '../schemas/node.schema'
import { reminderQueue } from '../jobs/queue'

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
  // Return only root-level nodes — children are nested inside each node
  return prisma.node.findMany({
    where: { listId, parentId: null },
    orderBy: { position: 'asc' },
    include: nodeInclude,
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
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      reminderAt: reminderAt ? new Date(reminderAt) : undefined,
      // If tagIds provided: replace all tags atomically
      tags: tagIds
        ? {
            deleteMany: {},
            create: tagIds.map((tagId) => ({ tagId })),
          }
        : undefined,
    },
    include: nodeInclude,
  })

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

  return node
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteNode = async (userId: string, nodeId: string) => {
  await assertNodeOwnership(userId, nodeId)
  // Prisma schema has onDelete: Cascade for children via self-referential relation
  return prisma.node.delete({ where: { id: nodeId } })
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
