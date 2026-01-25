import { assertEmptyRest } from './assert.js'
import { typedView } from './array.js'
import { E_STRING } from './fallback/_utils.js'
import * as js from './fallback/base32.js'

// See https://datatracker.ietf.org/doc/html/rfc4648

// 8 chars per 5 bytes

const { E_PADDING } = js

export const toBase32 = (arr, { padding = false } = {}) => js.toBase32(arr, false, padding)
export const toBase32hex = (arr, { padding = false } = {}) => js.toBase32(arr, true, padding)

// By default, valid padding is accepted but not required
export function fromBase32(str, options) {
  if (!options) return fromBase32common(str, false, 'both', 'uint8', null)
  const { format = 'uint8', padding = 'both', ...rest } = options
  return fromBase32common(str, false, padding, format, rest)
}

export function fromBase32hex(str, options) {
  if (!options) return fromBase32common(str, true, 'both', 'uint8', null)
  const { format = 'uint8', padding = 'both', ...rest } = options
  return fromBase32common(str, true, padding, format, rest)
}

function fromBase32common(str, isBase32Hex, padding, format, rest) {
  if (typeof str !== 'string') throw new TypeError(E_STRING)
  if (rest !== null) assertEmptyRest(rest)

  if (padding === true) {
    if (str.length % 8 !== 0) throw new SyntaxError(E_PADDING)
  } else if (padding === false) {
    if (str.endsWith('=')) throw new SyntaxError('Did not expect padding in base32 input')
  } else if (padding !== 'both') {
    throw new TypeError('Invalid padding option')
  }

  return typedView(js.fromBase32(str, isBase32Hex), format)
}
