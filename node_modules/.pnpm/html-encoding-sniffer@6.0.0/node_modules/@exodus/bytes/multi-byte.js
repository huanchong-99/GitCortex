import { assertUint8 } from './assert.js'
import { multibyteDecoder } from './fallback/multi-byte.js'

export function createMultibyteDecoder(encoding, loose = false) {
  const jsDecoder = multibyteDecoder(encoding, loose) // asserts
  let streaming = false
  return (arr, stream = false) => {
    assertUint8(arr)
    if (!streaming && arr.byteLength === 0) return ''
    streaming = stream
    return jsDecoder(arr, stream)
  }
}
