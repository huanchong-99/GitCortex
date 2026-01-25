import { assertUint8 } from './assert.js'
import { typedView } from './array.js'
import { skipWeb } from './fallback/_utils.js'
import * as js from './fallback/hex.js'

const { toHex: webHex } = Uint8Array.prototype // Modern engines have this

export function toHex(arr) {
  assertUint8(arr)
  if (arr.length === 0) return ''
  if (!skipWeb && webHex && arr.toHex === webHex) return arr.toHex()
  return js.toHex(arr)
}

// Unlike Buffer.from(), throws on invalid input
export const fromHex =
  !skipWeb && Uint8Array.fromHex
    ? (str, format = 'uint8') => typedView(Uint8Array.fromHex(str), format)
    : (str, format = 'uint8') => typedView(js.fromHex(str), format)
