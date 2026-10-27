import { Router } from 'express'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { parseProfileInput, syncUserSkills } from '../lib/profile-input.js'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireSameOrigin } from '../middleware/require-same-origin.js'

const router = Router()
const usernamePattern = /^[a-z0-9_]{3,30}$/

function toProfile(user) {
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    city: user.city,
    experience: user.experience,
    description: user.description,
    createdAt: user.createdAt,
    skills: (user.skills ?? []).map(({ skill }) => skill.name),
  }
}

const publicProfileSelect = {
  id: true,
  name: true,
  username: true,
  city: true,
  experience: true,
  description: true,
  createdAt: true,
  skills: { select: { skill: { select: { name: true } } } },
}

router.get('/', async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : ''
    const skill = typeof req.query.skill === 'string' ? req.query.skill.trim().slice(0, 60) : ''
    const city = typeof req.query.city === 'string' ? req.query.city.trim().slice(0, 60) : ''
    const experience = typeof req.query.experience === 'string'
      ? req.query.experience.trim().toUpperCase()
      : ''
    const experienceValues = ['BEGINNER', 'JUNIOR', 'INTERMEDIATE', 'SENIOR']
    if (experience && !experienceValues.includes(experience)) {
      return res.status(400).json({
        error: { code: 'INVALID_FILTER', message: 'Choose a valid experience level.' },
      })
    }
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    const pageSize = 20
    const users = await prisma.user.findMany({
      where: {
        username: { not: null },
        ...(query ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { username: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
            { skills: { some: { skill: { name: { contains: query, mode: 'insensitive' } } } } },
          ],
        } : {}),
        ...(skill ? { skills: { some: { skill: { name: { contains: skill, mode: 'insensitive' } } } } } : {}),
        ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
        ...(experience ? { experience } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: pageSize + 1,
      select: publicProfileSelect,
    })
    const hasMore = users.length > pageSize
    const profiles = users.slice(0, pageSize)
    return res.json({
      profiles: profiles.map(toProfile),
      hasMore,
      nextCursor: hasMore ? profiles.at(-1)?.id ?? null : null,
    })
  } catch {
    console.error('Public developer profiles could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load developer profiles.' },
    })
  }
})

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.user.id },
      select: {
        ...publicProfileSelect,
        passwordHash: true,
      },
    })
    return res.json({ profile: { ...toProfile(user), hasPassword: Boolean(user?.passwordHash) } })
  } catch {
    console.error('Own profile could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load your profile.' },
    })
  }
})

router.get('/u/:username', async (req, res) => {
  const username = req.params.username.trim().toLowerCase()
  if (!usernamePattern.test(username)) {
    return res.status(404).json({
      error: { code: 'PROFILE_NOT_FOUND', message: 'This profile could not be found.' },
    })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: publicProfileSelect,
    })
    if (!user) {
      return res.status(404).json({
        error: { code: 'PROFILE_NOT_FOUND', message: 'This profile could not be found.' },
      })
    }
    return res.json({ profile: toProfile(user) })
  } catch {
    console.error('Public profile could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load this profile.' },
    })
  }
})

router.patch('/me', requireSameOrigin, authenticate, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const username = typeof req.body?.username === 'string'
    ? req.body.username.trim().toLowerCase()
    : ''
  const { errors, profile } = parseProfileInput(req.body ?? {})

  if (!name || name.length > 100) errors.name = 'Enter a name up to 100 characters.'
  if (!usernamePattern.test(username)) {
    errors.username = 'Use 3-30 letters, numbers, or underscores.'
  }
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Check the highlighted fields.', fields: errors },
    })
  }

  try {
    const duplicate = await prisma.user.findUnique({ where: { username }, select: { id: true } })
    if (duplicate && duplicate.id !== req.auth.user.id) {
      return res.status(409).json({
        error: {
          code: 'USERNAME_IN_USE',
          message: 'That username is already in use.',
          fields: { username: 'That username is already in use.' },
        },
      })
    }

    const user = await prisma.$transaction(async (transaction) => {
      await transaction.userSkill.deleteMany({ where: { userId: req.auth.user.id } })
      await transaction.user.update({
        where: { id: req.auth.user.id },
        data: {
          name,
          username,
          city: profile.city,
          experience: profile.experience,
          description: profile.description,
          profileDetailsPromptPending: false,
        },
      })
      await syncUserSkills(transaction, req.auth.user.id, profile.skills)
      return transaction.user.findUnique({
        where: { id: req.auth.user.id },
        select: publicProfileSelect,
      })
    })
    return res.json({ profile: toProfile(user) })
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        error: {
          code: 'USERNAME_IN_USE',
          message: 'That username is already in use.',
          fields: { username: 'That username is already in use.' },
        },
      })
    }
    console.error('Profile update failed')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not save your profile.' },
    })
  }
})

router.post('/me/password', requireSameOrigin, authenticate, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string'
    ? req.body.currentPassword
    : ''
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
  const errors = {}
  const passwordLength = Array.from(newPassword).length

  if (!currentPassword || currentPassword.length > 128) {
    errors.currentPassword = 'Enter your current password.'
  }
  if (passwordLength < 8 || passwordLength > 128) {
    errors.newPassword = 'Password must be 8-128 characters.'
  }
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Check the highlighted fields.', fields: errors },
    })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.user.id },
      select: { passwordHash: true },
    })
    if (!user?.passwordHash) {
      return res.status(409).json({
        error: { code: 'PASSWORD_NOT_AVAILABLE', message: 'This account does not have a password.' },
      })
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return res.status(400).json({
        error: {
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password is incorrect.',
          fields: { currentPassword: 'Current password is incorrect.' },
        },
      })
    }

    await prisma.user.update({
      where: { id: req.auth.user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    })
    return res.json({ message: 'Password updated.' })
  } catch {
    console.error('Password change failed')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not change your password.' },
    })
  }
})

export default router
