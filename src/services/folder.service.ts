import prisma from '../config/prisma'
import { CreateFolderInput, UpdateFolderInput } from '../schemas/folder.schema'
import { getOrCreateDailyList } from './daily.service'
import { AppError } from '../utils/AppError'

export const getFolders = async (userId: string) => {
  // Provision Daily Tasks folder for any user that doesn't have one yet
  await getOrCreateDailyList(userId)

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

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { dailyFolderId: true } })
  if (user?.dailyFolderId === folderId) throw new AppError(403, 'Cannot rename the Daily Tasks folder')

  return prisma.folder.update({
    where: { id: folderId },
    data: input,
  })
}

export const deleteFolder = async (userId: string, folderId: string) => {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } })
  if (!folder) throw new Error('Folder not found')

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { dailyFolderId: true } })
  if (user?.dailyFolderId === folderId) throw new AppError(403, 'Cannot delete the Daily Tasks folder')

  return prisma.folder.delete({ where: { id: folderId } })
}
