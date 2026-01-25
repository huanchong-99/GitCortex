import { hashSync } from '@exodus/crypto/hash' // eslint-disable-line @exodus/import/no-deprecated
import { makeBase58check } from './fallback/base58check.js'

// Note: while API is async, we use hashSync for now until we improve webcrypto perf for hash256
// Inputs to base58 are typically very small, and that makes a difference

// eslint-disable-next-line @exodus/import/no-deprecated
const sha256 = (x) => hashSync('sha256', x, 'uint8')
const hash256sync = (x) => sha256(sha256(x))
const hash256 = hash256sync // See note at the top
const {
  encode: toBase58check,
  decode: fromBase58check,
  encodeSync: toBase58checkSync,
  decodeSync: fromBase58checkSync,
} = makeBase58check(hash256, hash256sync)

export { makeBase58check } from './fallback/base58check.js'
export { toBase58check, fromBase58check, toBase58checkSync, fromBase58checkSync }
