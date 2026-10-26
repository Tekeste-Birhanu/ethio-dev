import { Router } from 'express'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'
import { parseProfileInput, syncUserSkills } from '../lib/profile-input.js'
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  findSession,
  readSessionId,
  setSessionCookie,
} from '../lib/session.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireSameOrigin } from '../middleware/require-same-origin.js'
import googleAuthRouter from './google-auth.routes.js'

const router = Router()
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usernamePattern = /^[a-z0-9_]{3,30}$/

router.use('/google', googleAuthRouter)

router.post('/register', requireSameOrigin, async (req, res) => {
  const body = req.body ?? {}
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const username =
    typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const errors = {}

  if (!name || name.length > 100) {
    errors.name = 'Enter a name up to 100 characters.'
  }

  if (email.length > 254 || !emailPattern.test(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!usernamePattern.test(username)) {
    errors.username = 'Use 3-30 letters, numbers, or underscores.'
  }

  const passwordLength = Array.from(password).length
  if (passwordLength < 8 || passwordLength > 128) {
    errors.password = 'Password must be 8-128 characters.'
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the highlighted fields.',
        fields: errors,
      },
    })
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true },
    })

    if (existingUser) {
      return res.status(409).json({
        error: {
          code: 'ACCOUNT_CONFLICT',
          message: 'Email or username is already in use.',
        },
      })
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        username,
        passwordHash,
        profileDetailsPromptPending: true,
      },
      select: { id: true, name: true, username: true },
    })

    return res.status(201).json({ user })
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        error: {
          code: 'ACCOUNT_CONFLICT',
          message: 'Email or username is already in use.',
        },
      })
    }

    console.error('Account registration failed')
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Could not create the account. Try again later.',
      },
    })
  }
})

router.post('/profile-details', requireSameOrigin, authenticate, async (req, res) => {
  const { errors, profile } = parseProfileInput(req.body ?? {})
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the highlighted fields.',
        fields: errors,
      },
    })
  }

  if (!req.auth.user.profileDetailsPromptPending) {
    return res.status(409).json({
      error: { code: 'PROFILE_SETUP_NOT_PENDING', message: 'Profile setup is already complete.' },
    })
  }

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const updatedUser = await transaction.user.update({
        where: { id: req.auth.user.id },
        data: {
          city: profile.city,
          experience: profile.experience,
          description: profile.description,
          profileDetailsPromptPending: false,
        },
        select: {
          id: true,
          name: true,
          username: true,
          profileDetailsPromptPending: true,
        },
      })
      await syncUserSkills(transaction, updatedUser.id, profile.skills)
      return updatedUser
    })
    return res.json({ user })
  } catch {
    console.error('Optional profile details could not be saved')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not save your profile. Try again.' },
    })
  }
})

router.post('/login', requireSameOrigin, async (req, res) => {
  const identifier =
    typeof req.body?.identifier === 'string'
      ? req.body.identifier.trim().toLowerCase()
      : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!identifier || !password || identifier.length > 254 || password.length > 128) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Enter your email or username and password.',
      },
    })
  }

  try {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      select: {
        id: true,
        name: true,
        username: true,
        passwordHash: true,
        profileDetailsPromptPending: true,
      },
    })

    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email/username or password is incorrect.',
        },
      })
    }

    const { sessionId } = await createSession(user.id)
    setSessionCookie(res, sessionId)
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        profileDetailsPromptPending: user.profileDetailsPromptPending,
      },
    })
  } catch {
    console.error('Sign-in failed')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not sign in. Try again later.' },
    })
  }
})

router.get('/me', async (req, res) => {
  try {
    const session = await findSession(readSessionId(req))
    if (!session) {
      clearSessionCookie(res)
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' },
      })
    }

    return res.json({ user: session.user })
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not verify your session.' },
    })
  }
})

router.post('/logout', requireSameOrigin, authenticate, async (req, res) => {
  try {
    await deleteSession(req.auth.sessionId)
    clearSessionCookie(res)
    return res.json({ message: 'Signed out.' })
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not sign out. Try again.' },
    })
  }
})

export default router
