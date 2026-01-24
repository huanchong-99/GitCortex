import * as js from './fallback/utf16.js'
import { canDecoders, isLE, E_STRING } from './fallback/_utils.js'

const { TextDecoder } = globalThis // Buffer is optional
const ignoreBOM = true
const decoderFatalLE = canDecoders ? new TextDecoder('utf-16le', { ignoreBOM, fatal: true }) : null
const decoderLooseLE = canDecoders ? new TextDecoder('utf-16le', { ignoreBOM }) : null
const decoderFatalBE = canDecoders ? new TextDecoder('utf-16be', { ignoreBOM, fatal: true }) : null
const decoderLooseBE = canDecoders ? new TextDecoder('utf-16be', { ignoreBOM }) : null
const decoderFatal16 = isLE ? decoderFatalLE : decoderFatalBE
const decoderLoose16 = isLE ? decoderLooseLE : decoderFatalBE
const { isWellFormed, toWellFormed } = String.prototype

const { E_STRICT, E_STRICT_UNICODE } = js

// Unlike utf8, operates on Uint16Arrays by default

const to8 = (a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength)

function encode(str, loose = false, format = 'uint16') {
  if (typeof str !== 'string') throw new TypeError(E_STRING)
  if (format !== 'uint16' && format !== 'uint8-le' && format !== 'uint8-be') {
    throw new TypeError('Unknown format')
  }

  const shouldSwap = (isLE && format === 'uint8-be') || (!isLE && format === 'uint8-le')

  // On v8 and SpiderMonkey, check via isWellFormed is faster than js
  // On JSC, check during loop is faster than isWellFormed
  // If isWellFormed is available, we skip check during decoding and recheck after
  // If isWellFormed is unavailable, we check in js during decoding
  if (!loose && isWellFormed && !isWellFormed.call(str)) throw new TypeError(E_STRICT_UNICODE)
  const u16 = js.encode(str, loose, !loose && isWellFormed, shouldSwap)

  if (format === 'uint8-le' || format === 'uint8-be') return to8(u16) // Already swapped
  if (format === 'uint16') return u16
  throw new Error('Unreachable')
}

function decode(input, loose = false, format = 'uint16') {
  let u16
  switch (format) {
    case 'uint16':
      if (!(input instanceof Uint16Array)) throw new TypeError('Expected an Uint16Array')
      if (canDecoders) return loose ? decoderLoose16.decode(input) : decoderFatal16.decode(input)
      u16 = input
      break
    case 'uint8-le':
      if (!(input instanceof Uint8Array)) throw new TypeError('Expected an Uint8Array')
      if (input.byteLength % 2 !== 0) throw new TypeError('Expected even number of bytes')
      if (canDecoders) return loose ? decoderLooseLE.decode(input) : decoderFatalLE.decode(input)
      u16 = js.to16input(input, true)
      break
    case 'uint8-be':
      if (!(input instanceof Uint8Array)) throw new TypeError('Expected an Uint8Array')
      if (input.byteLength % 2 !== 0) throw new TypeError('Expected even number of bytes')
      if (canDecoders) return loose ? decoderLooseBE.decode(input) : decoderFatalBE.decode(input)
      u16 = js.to16input(input, false)
      break
    default:
      throw new TypeError('Unknown format')
  }

  const str = js.decode(u16, loose, (!loose && isWellFormed) || (loose && toWellFormed))
  if (!loose && isWellFormed && !isWellFormed.call(str)) throw new TypeError(E_STRICT)
  if (loose && toWellFormed) return toWellFormed.call(str)

  return str
}

export const utf16fromString = (str, format = 'uint16') => encode(str, false, format)
export const utf16fromStringLoose = (str, format = 'uint16') => encode(str, true, format)
export const utf16toString = (arr, format = 'uint16') => decode(arr, false, format)
export const utf16toStringLoose = (arr, format = 'uint16') => decode(arr, true, format)
