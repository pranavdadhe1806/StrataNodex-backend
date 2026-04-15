import prisma from '../config/prisma'
import { CreateFolderInput, UpdateFolderInput } from '../schemas/folder.schema'

export const getFolders = async (userId: string) => {
  return prisma.folder.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
    include: { lists: { orderBy: { position: 'asc' } } },
  })
}

export const createFolder = async (userId: string, input: CreateFolderInput) => {
  return prisma.folder.create({
    data: {
      name: input.name,
      position: input.position ?? 0,
      userId,
    },
  })
}

export const updateFolder = async (userId: string, folderId: string, input: UpdateFolderInput) => {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } })
  if (!folder) throw new Error('Folder not found')

  return prisma.folder.update({
    where: { id: folderId },
    data: input,
  })
}

export const deleteFolder = async (userId: string, folderId: string) => {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } })
  if (!folder) throw new Error('Folder not found')

  return prisma.folder.delete({ where: { id: folderId } })
}
