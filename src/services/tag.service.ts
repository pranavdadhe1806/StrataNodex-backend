import prisma from '../config/prisma'
import { CreateTagInput, UpdateTagInput } from '../schemas/tag.schema'

export const getTags = async (userId: string) => {
  return prisma.tag.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  })
}

export const createTag = async (userId: string, input: CreateTagInput) => {
  return prisma.tag.create({
    data: {
      name: input.name,
      color: input.color ?? '#888888',
      userId,
    },
  })
}

export const updateTag = async (userId: string, tagId: string, input: UpdateTagInput) => {
  const tag = await prisma.tag.findFirst({ where: { id: tagId, userId } })
  if (!tag) throw new Error('Tag not found')

  return prisma.tag.update({
    where: { id: tagId },
    data: input,
  })
}

export const deleteTag = async (userId: string, tagId: string) => {
  const tag = await prisma.tag.findFirst({ where: { id: tagId, userId } })
  if (!tag) throw new Error('Tag not found')

  return prisma.tag.delete({ where: { id: tagId } })
}
