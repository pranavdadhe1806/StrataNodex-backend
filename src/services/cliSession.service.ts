import crypto from 'crypto'
import prisma from '../config/prisma'
import { AppError } from '../utils/AppError'

const SESSION_TTL_MINUTES = 10

/**
 * Creates a new pending CLI session.
 * Returns the short code the CLI will use to poll.
 */
export const createCliSession = async (): Promise<{ code: string; expiresAt: Date }> => {
  const code = crypto.randomBytes(16).toString('hex') // 32-char hex string
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000)

  const session = await prisma.cliSession.create({
    data: { code, expiresAt },
  })

  return { code: session.code, expiresAt: session.expiresAt }
}

/**
 * Called by the CLI every 2 seconds to check if login is complete.
 * Returns { pending: true } if not yet complete.
 * Returns { token: string } and marks session as used if complete.
 * Throws 404 if code not found or expired.
 * Throws 410 if already used.
 */
export const pollCliSession = async (
  code: string
): Promise<{ pending: true } | { token: string }> => {
  const session = await prisma.cliSession.findUnique({ where: { code } })

  if (!session) throw new AppError(404, 'Session not found')
  if (session.expiresAt < new Date()) throw new AppError(410, 'Session expired')
  if (session.usedAt) throw new AppError(410, 'Session already used')

  // Still waiting for user to log in
  if (!session.token) return { pending: true }

  // Login complete — mark as used and return token
  await prisma.cliSession.update({
    where: { code },
    data: { usedAt: new Date() },
  })

  return { token: session.token }
}

/**
 * Called by the website after successful login.
 * Attaches the JWT to the pending session so the CLI can claim it.
 * Throws 404 if code not found or expired.
 * Throws 409 if already completed.
 */
export const completeCliSession = async (
  code: string,
  token: string
): Promise<void> => {
  const session = await prisma.cliSession.findUnique({ where: { code } })

  if (!session) throw new AppError(404, 'Session not found')
  if (session.expiresAt < new Date()) throw new AppError(410, 'Session expired')
  if (session.token) throw new AppError(409, 'Session already completed')

  await prisma.cliSession.update({
    where: { code },
    data: { token },
  })
}
