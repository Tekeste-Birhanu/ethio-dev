import { findSession, readSessionId } from '../lib/session.js'

export async function authenticate(req, res, next) {
  const sessionId = readSessionId(req)

  try {
    const session = await findSession(sessionId)
    if (!session) {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' },
      })
    }

    req.auth = { sessionId, user: session.user }
    return next()
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not verify your session.' },
    })
  }
}
