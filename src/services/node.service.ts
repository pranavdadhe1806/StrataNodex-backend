import prisma from '../config/prisma'
import { CreateNodeInput, UpdateNodeInput } from '../schemas/node.schema'

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

export const getNodes = async (userId: string, listId: string) => {
  await assertListOwnership(userId, listId)
  return prisma.node.findMany({
    where: { listId },
    orderBy: { position: 'asc' },
    include: {
      tags: { include: { tag: true } },
      children: { orderBy: { position: 'asc' } },
    },
  })
}

export const getNodeById = async (userId: string, nodeId: string) => {
  await assertNodeOwnership(userId, nodeId)
  return prisma.node.findUnique({
    where: { id: nodeId },
    include: {
      tags: { include: { tag: true } },
      children: { orderBy: { position: 'asc' } },
    },
  })
}

export const createNode = async (userId: string, input: CreateNodeInput) => {
  await assertListOwnership(userId, input.listId)

  const { tagIds, startAt, endAt, reminderAt, ...rest } = input

  return prisma.node.create({
    data: {
      ...rest,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      reminderAt: reminderAt ? new Date(reminderAt) : undefined,
      tags: tagIds
        ? { create: tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
    include: { tags: { include: { tag: true } } },
  })
}

export const updateNode = async (userId: string, nodeId: string, input: UpdateNodeInput) => {
  await assertNodeOwnership(userId, nodeId)

  const { tagIds, startAt, endAt, reminderAt, ...rest } = input

  return prisma.node.update({
    where: { id: nodeId },
    data: {
      ...rest,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      reminderAt: reminderAt ? new Date(reminderAt) : undefined,
      tags: tagIds
        ? {
            deleteMany: {},
            create: tagIds.map((tagId) => ({ tagId })),
          }
        : undefined,
    },
    include: { tags: { include: { tag: true } } },
  })
}

export const deleteNode = async (userId: string, nodeId: string) => {
  await assertNodeOwnership(userId, nodeId)
  return prisma.node.delete({ where: { id: nodeId } })
}
