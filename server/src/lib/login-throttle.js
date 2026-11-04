const FAILURE_WINDOWS = [
  { attempts: 5, delayMs: 30 * 1000 },
  { attempts: 8, delayMs: 2 * 60 * 1000 },
  { attempts: 12, delayMs: 15 * 60 * 1000 },
]
const ENTRY_TTL_MS = 60 * 60 * 1000
const MAX_ENTRIES = 10_000

const attemptsByKey = new Map()

function pruneEntries(now) {
  for (const [key, entry] of attemptsByKey) {
    if (now - entry.lastAttemptAt >= ENTRY_TTL_MS) attemptsByKey.delete(key)
  }

  while (attemptsByKey.size > MAX_ENTRIES) {
    const oldestKey = attemptsByKey.keys().next().value
    attemptsByKey.delete(oldestKey)
  }
}

function throttleKeys(identifier, ipAddress) {
  const normalizedIp = ipAddress || 'unknown'
  return [`pair:${normalizedIp}:${identifier}`, `ip:${normalizedIp}`]
}

function getCooldown(entry) {
  let delayMs = 0
  for (const window of FAILURE_WINDOWS) {
    if (entry.failures >= window.attempts) delayMs = window.delayMs
  }
  return delayMs
}

export function getLoginRetryAfter(identifier, ipAddress, now = Date.now()) {
  pruneEntries(now)
  let retryAfterMs = 0

  for (const key of throttleKeys(identifier, ipAddress)) {
    const entry = attemptsByKey.get(key)
    if (!entry) continue

    const remainingMs = entry.lastAttemptAt + getCooldown(entry) - now
    retryAfterMs = Math.max(retryAfterMs, remainingMs)
  }

  return Math.max(0, Math.ceil(retryAfterMs / 1000))
}

export function recordFailedLogin(identifier, ipAddress, now = Date.now()) {
  pruneEntries(now)

  for (const key of throttleKeys(identifier, ipAddress)) {
    const entry = attemptsByKey.get(key) ?? { failures: 0 }
    entry.failures += 1
    entry.lastAttemptAt = now
    attemptsByKey.delete(key)
    attemptsByKey.set(key, entry)
  }
}

export function clearLoginFailures(identifier, ipAddress) {
  for (const key of throttleKeys(identifier, ipAddress)) {
    attemptsByKey.delete(key)
  }
}
