import { randomBytes, timingSafeEqual } from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import {
  appendCookies,
  createSession,
  setSessionCookie,
} from '../lib/session.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireSameOrigin } from '../middleware/require-same-origin.js'

const router = Router()
const stateCookieName = 'ethio_dev_oauth_state'
const verifierCookieName = 'ethio_dev_oauth_verifier'
const oauthCookieDurationSeconds = 600
const usernamePattern = /^[a-z0-9_]{3,30}$/

function googleConfig() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth environment variables are not configured')
  }

  return {
    clientId: GOOGLE_CLIENT_ID,
    redirectUri:
      process.env.GOOGLE_CALLBACK_URL ??
      'http://localhost:3000/api/auth/google/callback',
  }
}

function createGoogleClient() {
  const config = googleConfig()
  return {
    ...config,
    client: new OAuth2Client(
      config.clientId,
      process.env.GOOGLE_CLIENT_SECRET,
      config.redirectUri,
    ),
  }
}

function cookieHeader(name, value, maxAge) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

function readCookie(req, name) {
  const prefix = `${name}=`
  const item = req.headers.cookie
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
  if (!item) return null

  try {
    return decodeURIComponent(item.slice(prefix.length))
  } catch {
    return null
  }
}

function clearOAuthCookies(res) {
  appendCookies(
    res,
    cookieHeader(stateCookieName, '', 0),
    cookieHeader(verifierCookieName, '', 0),
  )
}

function redirectToClient(res, query = '') {
  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'
  return res.redirect(303, `${clientOrigin}/${query}`)
}

function failOAuth(res, reason = 'failed') {
  clearOAuthCookies(res)
  return redirectToClient(res, `?authError=${encodeURIComponent(reason)}`)
}

function isSameState(receivedState, expectedState) {
  if (!receivedState || !expectedState) return false
  const received = Buffer.from(receivedState)
  const expected = Buffer.from(expectedState)
  return received.length === expected.length && timingSafeEqual(received, expected)
}

function safeErrorCode(error) {
  const code = error?.response?.data?.error ?? error?.code
  return typeof code === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(code)
    ? code
    : undefined
}

router.get('/', async (_req, res) => {
  try {
    const { client, redirectUri } = createGoogleClient()
    const state = randomBytes(32).toString('base64url')
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync()

    appendCookies(
      res,
      cookieHeader(stateCookieName, state, oauthCookieDurationSeconds),
      cookieHeader(verifierCookieName, codeVerifier, oauthCookieDurationSeconds),
    )

    return res.redirect(
      client.generateAuthUrl({
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: ['openid', 'email', 'profile'],
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      }),
    )
  } catch {
    console.error('Google sign-in could not be started')
    return failOAuth(res)
  }
})

router.get('/callback', async (req, res) => {
  if (req.query.error) return failOAuth(res, 'cancelled')

  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const expectedState = readCookie(req, stateCookieName)
  const codeVerifier = readCookie(req, verifierCookieName)

  if (!isSameState(state, expectedState) || !code || !codeVerifier) {
    const reason = !isSameState(state, expectedState)
      ? 'state_mismatch'
      : !code
        ? 'missing_authorization_code'
        : 'missing_pkce_cookie'
    console.warn('Google OAuth callback rejected', { reason })
    return failOAuth(res)
  }

  let stage = 'exchange_code'
  try {
    const { client, clientId, redirectUri } = createGoogleClient()
    const { tokens } = await client.getToken({
      code,
      codeVerifier,
      redirect_uri: redirectUri,
    })
    if (!tokens.id_token) return failOAuth(res)

    stage = 'verify_identity_token'
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId })
    const profile = ticket.getPayload()
    if (
      !profile?.sub ||
      !profile.email ||
      profile.email_verified !== true
    ) {
      return failOAuth(res)
    }

    const email = profile.email.trim().toLowerCase()
    const name = (profile.name || profile.given_name || 'Developer').trim().slice(0, 100)
    stage = 'find_or_link_account'
    let user = await prisma.user.findUnique({
      where: { googleSubject: profile.sub },
      select: { id: true, username: true, profileDetailsPromptPending: true },
    })

    if (!user) {
      const emailAccount = await prisma.user.findUnique({
        where: { email },
        select: { id: true, googleSubject: true, username: true },
      })

      if (emailAccount) {
        if (emailAccount.googleSubject && emailAccount.googleSubject !== profile.sub) {
          return failOAuth(res)
        }
        user = await prisma.user.update({
          where: { id: emailAccount.id },
          data: { googleSubject: profile.sub },
          select: { id: true, username: true, profileDetailsPromptPending: true },
        })
      } else {
        user = await prisma.user.create({
          data: {
            email,
            name,
            googleSubject: profile.sub,
            profileDetailsPromptPending: true,
          },
          select: { id: true, username: true, profileDetailsPromptPending: true },
        })
      }
    }

    stage = 'create_session'
    const { sessionId } = await createSession(user.id)
    clearOAuthCookies(res)
    setSessionCookie(res, sessionId)
    return redirectToClient(res)
  } catch (error) {
    console.error('Google OAuth callback failed', {
      stage,
      code: safeErrorCode(error),
      status: Number.isInteger(error?.response?.status)
        ? error.response.status
        : undefined,
    })
    return failOAuth(res)
  }
})

router.post('/complete-profile', requireSameOrigin, authenticate, async (req, res) => {
  const username =
    typeof req.body?.username === 'string'
      ? req.body.username.trim().toLowerCase()
      : ''

  if (!usernamePattern.test(username)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Use 3-30 letters, numbers, or underscores for your username.',
        fields: { username: 'Use 3-30 letters, numbers, or underscores.' },
      },
    })
  }

  if (req.auth.user.username) {
    return res.status(409).json({
      error: { code: 'PROFILE_ALREADY_COMPLETE', message: 'Your username is already set.' },
    })
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    })
    if (existing) {
      return res.status(409).json({
        error: {
          code: 'USERNAME_IN_USE',
          message: 'That username is already in use. Try another one.',
          fields: { username: 'That username is already in use.' },
        },
      })
    }

    const user = await prisma.user.update({
      where: { id: req.auth.user.id },
      data: { username },
      select: {
        id: true,
        name: true,
        username: true,
        profileDetailsPromptPending: true,
      },
    })
    return res.json({ user })
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        error: {
          code: 'USERNAME_IN_USE',
          message: 'That username is already in use. Try another one.',
          fields: { username: 'That username is already in use.' },
        },
      })
    }

    console.error('Google profile setup failed')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not complete your profile. Try again.' },
    })
  }
})

export default router
