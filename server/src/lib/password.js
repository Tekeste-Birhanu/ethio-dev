import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const COST = 2 ** 15
const BLOCK_SIZE = 8
const PARALLELIZATION = 3
const KEY_LENGTH = 64
const MAX_MEMORY = 64 * 1024 * 1024
export const DUMMY_PASSWORD_HASH =
  'scrypt$32768$8$3$RXRoaW9EZXZEdW1teVNhbHQ$4F46izttHHtWNhprUTj23iAGqxlLX6sII2RZ4VvDoIed1qirz-Y3deADB8feB9OPGVCq2t6RheNpExyqIsVE0w'

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  })

  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString('base64url'),
    Buffer.from(derivedKey).toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password, encodedHash) {
  const [algorithm, cost, blockSize, parallelization, encodedSalt, encodedKey] =
    encodedHash?.split('$') ?? []

  if (algorithm !== 'scrypt' || !encodedSalt || !encodedKey) return false

  const parameters = [cost, blockSize, parallelization].map(Number)
  if (
    parameters[0] !== COST ||
    parameters[1] !== BLOCK_SIZE ||
    parameters[2] !== PARALLELIZATION
  ) {
    return false
  }

  try {
    const salt = Buffer.from(encodedSalt, 'base64url')
    const expectedKey = Buffer.from(encodedKey, 'base64url')
    if (salt.length !== 16 || expectedKey.length !== KEY_LENGTH) return false

    const actualKey = Buffer.from(
      await scrypt(password, salt, KEY_LENGTH, {
        N: COST,
        r: BLOCK_SIZE,
        p: PARALLELIZATION,
        maxmem: MAX_MEMORY,
      }),
    )

    return timingSafeEqual(actualKey, expectedKey)
  } catch {
    return false
  }
}
