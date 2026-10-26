import { createHash, randomBytes } from 'node:crypto'
import { prisma } from './prisma.js'

export const SESSION_COOKIE = 'ethio_dev_session'
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

function hashSessionId(sessionId) {
  return createHash('sha256').update(sessionId).digest('hex')
}

function cookieOptions(maxAge, sessionId = '') {
  const parts = [
    `${SESSION_COOKIE}=${maxAge > 0 ? encodeURIComponent(sessionId) : ''}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAge / 1000))}`,
  ]

  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

export function setSessionCookie(res, sessionId) {
  appendCookies(res, cookieOptions(SESSION_DURATION_MS, sessionId))
}

export function clearSessionCookie(res) {
  appendCookies(res, cookieOptions(0, ''))
}

export function appendCookies(res, ...cookies) {
  const current = res.getHeader('Set-Cookie')
  const existing = Array.isArray(current) ? current : current ? [current] : []
  res.setHeader('Set-Cookie', [...existing, ...cookies])
}

export function readSessionId(req) {
  const cookies = req.headers.cookie?.split(';') ?? []
  const prefix = `${SESSION_COOKIE}=`
  const entry = cookies.map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(prefix))
  if (!entry) return null
  try {
    return decodeURIComponent(entry.slice(prefix.length))
  } catch {
    return null
  }
}

export async function createSession(userId) {
  const sessionId = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } })
  await prisma.session.create({
    data: { id: hashSessionId(sessionId), userId, expiresAt },
  })

  return { sessionId, expiresAt }
}

export async function findSession(sessionId) {
  if (!sessionId) return null

  return prisma.session.findFirst({
    where: { id: hashSessionId(sessionId), expiresAt: { gt: new Date() } },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          profileDetailsPromptPending: true,
        },
      },
    },
  })
}

export async function deleteSession(sessionId) {
  if (!sessionId) return
  await prisma.session.deleteMany({ where: { id: hashSessionId(sessionId) } })
}
