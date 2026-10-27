export function requireSameOrigin(req, res, next) {
  const origin = req.get('origin')
  const allowedOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'

  if (!origin || origin !== allowedOrigin) {
    return res.status(403).json({
      error: { code: 'INVALID_ORIGIN', message: 'This request is not allowed.' },
    })
  }

  return next()
}
