import prisma from '../config/prisma'
import { CreateTagInput, UpdateTagInput } from '../schemas/tag.schema'

// ─── Get tags ─────────────────────────────────────────────────────────────────

export const getTags = async (userId: string, listId?: string) => {
  if (listId) {
    // Verify list ownership before filtering
    const list = await prisma.list.findFirst({ where: { id: listId, folder: { userId } } })
    if (!list) throw new Error('List not found')

    // Return global tags (listId=null) + tags scoped to this list
    return prisma.tag.findMany({
      where: {
        userId,
        OR: [{ listId: null }, { listId }],
      },
      orderBy: { name: 'asc' },
    })
  }

  // No listId — return only global tags
  return prisma.tag.findMany({
    where: { userId, listId: null },
    orderBy: { name: 'asc' },
  })
}

// ─── Create ───────────────────────────────────────────────────────────────────

export const createTag = async (userId: string, input: CreateTagInput) => {
  // If listId provided, verify user owns the list
  if (input.listId) {
    const list = await prisma.list.findFirst({ where: { id: input.listId, folder: { userId } } })
    if (!list) throw new Error('List not found')
  }

  return prisma.tag.create({
    data: {
      name: input.name,
      color: input.color ?? '#888888',
      userId,
      listId: input.listId ?? null,
    },
  })
}

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateTag = async (userId: string, tagId: string, input: UpdateTagInput) => {
  const tag = await prisma.tag.findFirst({ where: { id: tagId, userId } })
  if (!tag) throw new Error('Tag not found')

  return prisma.tag.update({
    where: { id: tagId },
    data: input,
  })
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteTag = async (userId: string, tagId: string) => {
  const tag = await prisma.tag.findFirst({ where: { id: tagId, userId } })
  if (!tag) throw new Error('Tag not found')

  // NodeTag rows cascade automatically via Prisma schema
  return prisma.tag.delete({ where: { id: tagId } })
}

// ─── Attach tag to node ───────────────────────────────────────────────────────

export const attachTag = async (userId: string, nodeId: string, tagId: string) => {
  // Verify user owns the node
  const node = await prisma.node.findFirst({
    where: { id: nodeId, list: { folder: { userId } } },
  })
  if (!node) throw new Error('Node not found')

  // Verify user owns the tag
  const tag = await prisma.tag.findFirst({ where: { id: tagId, userId } })
  if (!tag) throw new Error('Tag not found')

  // Upsert to handle duplicate attach gracefully
  return prisma.nodeTag.upsert({
    where: { nodeId_tagId: { nodeId, tagId } },
    create: { nodeId, tagId },
    update: {}, // already exists — no-op
  })
}

// ─── Detach tag from node ─────────────────────────────────────────────────────

export const detachTag = async (userId: string, nodeId: string, tagId: string) => {
  // Verify node ownership before detach
  const node = await prisma.node.findFirst({
    where: { id: nodeId, list: { folder: { userId } } },
  })
  if (!node) throw new Error('Node not found')

  return prisma.nodeTag.delete({
    where: { nodeId_tagId: { nodeId, tagId } },
  })
}
