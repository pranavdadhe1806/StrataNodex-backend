import prisma from '../config/prisma'
import { CreateListInput, UpdateListInput } from '../schemas/list.schema'

const assertFolderOwnership = async (userId: string, folderId: string) => {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } })
  if (!folder) throw new Error('Folder not found')
  return folder
}

const assertListOwnership = async (userId: string, listId: string) => {
  const list = await prisma.list.findFirst({
    where: { id: listId, folder: { userId } },
  })
  if (!list) throw new Error('List not found')
  return list
}

export const getLists = async (userId: string, folderId: string) => {
  await assertFolderOwnership(userId, folderId)
  return prisma.list.findMany({
    where: { folderId },
    orderBy: { position: 'asc' },
  })
}

export const createList = async (userId: string, input: CreateListInput) => {
  await assertFolderOwnership(userId, input.folderId)
  return prisma.list.create({
    data: {
      name: input.name,
      folderId: input.folderId,
      position: input.position ?? 0,
    },
  })
}

export const updateList = async (userId: string, listId: string, input: UpdateListInput) => {
  await assertListOwnership(userId, listId)
  return prisma.list.update({
    where: { id: listId },
    data: input,
  })
}

export const deleteList = async (userId: string, listId: string) => {
  await assertListOwnership(userId, listId)
  return prisma.list.delete({ where: { id: listId } })
}
