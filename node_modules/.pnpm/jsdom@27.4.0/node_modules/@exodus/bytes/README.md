# `@exodus/bytes`

[![](https://flat.badgen.net/npm/v/@exodus/bytes)](https://npmjs.org/package/@exodus/bytes)
![](https://flat.badgen.net/npm/dm/@exodus/bytes)
[![](https://flat.badgen.net/npm/license/@exodus/bytes)](https://github.com/ExodusOSS/bytes/blob/HEAD/LICENSE)

`Uint8Array` conversion to and from `base64`, `base32`, `base58`, `hex`, `utf8`, `utf16`, `bech32` and `wif`

And a [`TextEncoder` / `TextDecoder` polyfill](#textencoder--textdecoder-polyfill)

## Strict

Performs proper input validation, ensures no garbage-in-garbage-out

Tested on Node.js, Deno, Bun, browsers (including Servo), Hermes, QuickJS and barebone engines in CI [(how?)](https://github.com/ExodusMovement/test#exodustest)

## Fast

* `10-20x` faster than `Buffer` polyfill
* `2-10x` faster than `iconv-lite`

The above was for the js fallback

It's up to `100x` when native impl is available \
e.g. in `utf8fromString` on Hermes / React Native or `fromHex` in Chrome

Also:
* `3-8x` faster than `bs58`
* `10-30x` faster than `@scure/base` (or `>100x` on Node.js <25)
* Faster in `utf8toString` / `utf8fromString` than `Buffer` or `TextDecoder` / `TextEncoder` on Node.js

See [Performance](./Performance.md) for more info

## TextEncoder / TextDecoder polyfill

```js
import { TextDecoder, TextEncoder } from '@exodus/bytes/encoding.js'
import { TextDecoderStream, TextEncoderStream } from '@exodus/bytes/encoding.js' // Requires Streams
```

Less than half the bundle size of [text-encoding](https://npmjs.com/text-encoding), [whatwg-encoding](https://npmjs.com/whatwg-encoding) or [iconv-lite](https://npmjs.com/iconv-lite) (gzipped or not).\
Also [much faster](#fast) than all of those.

> [!TIP]
> See also the [lite version](#lite-version) to get this down to 10 KiB gzipped.

Spec compliant, passing WPT and covered with extra tests.\
Moreover, tests for this library uncovered [bugs in all major implementations](https://docs.google.com/spreadsheets/d/1pdEefRG6r9fZy61WHGz0TKSt8cO4ISWqlpBN5KntIvQ/edit).\
Including all three major browser engines being wrong at UTF-8.\
See [WPT pull request](https://github.com/web-platform-tests/wpt/pull/56892).

It works correctly even in environments that have native implementations broken (that's all of them currently).\
Runs (and passes WPT) on Node.js built without ICU.

> [!NOTE]
> [Faster than Node.js native implementation on Node.js](https://github.com/nodejs/node/issues/61041#issuecomment-3649242024).
>
> The JS multi-byte version is as fast as native impl in Node.js and browsers, but (unlike them) returns correct results.
>
> For encodings where native version is known to be fast and correct, it is automatically used.\
> Some single-byte encodings are faster than native in all three major browser engines.

See [analysis table](https://docs.google.com/spreadsheets/d/1pdEefRG6r9fZy61WHGz0TKSt8cO4ISWqlpBN5KntIvQ/edit) for more info.

### Caveat: `TextDecoder` / `TextEncoder` APIs are lossy by default per spec

_These are only provided as a compatibility layer, prefer hardened APIs instead in new code._

 * `TextDecoder` can (and should) be used with `{ fatal: true }` option for all purposes demanding correctness / lossless transforms

 * `TextEncoder` does not support a fatal mode per spec, it always performs replacement.

   That is not suitable for hashing, cryptography or consensus applications.\
   Otherwise there would be non-equal strings with equal signatures and hashes — the collision is caused by the lossy transform of a JS string to bytes.
   Those also survive e.g. `JSON.stringify`/`JSON.parse` or being sent over network.

   Use strict APIs in new applications, see `utf8fromString` / `utf16fromString` below.\
   Those throw on non-well-formed strings by default.

### Lite version

If you don't need support for legacy multi-byte encodings, you can use the lite import:
```js
import { TextDecoder, TextEncoder } from '@exodus/bytes/encoding-lite.js'
import { TextDecoderStream, TextEncoderStream } from '@exodus/bytes/encoding-lite.js' // Requires Streams
```

This reduces the bundle size 9x:\
from 90 KiB gzipped for `@exodus/bytes/encoding.js` to 10 KiB gzipped for `@exodus/bytes/encoding-lite.js`.\
(For comparison, `text-encoding` module is 190 KiB gzipped, and `iconv-lite` is 194 KiB gzipped):

It still supports `utf-8`, `utf-16le`, `utf-16be` and all single-byte encodings specified by the spec,
the only difference is support for legacy multi-byte encodings.

See [the list of encodings](https://encoding.spec.whatwg.org/#names-and-labels).

## API

### `@exodus/bytes/utf8.js`

```js
import { utf8fromString, utf8toString } from '@exodus/bytes/utf8.js'

// loose
import { utf8fromStringLoose, utf8toStringLoose } from '@exodus/bytes/utf8.js'
```

##### `utf8fromString(str, format = 'uint8')`
##### `utf8fromStringLoose(str, format = 'uint8')`
##### `utf8toString(arr)`
##### `utf8toStringLoose(arr)`

### `@exodus/bytes/utf16.js`

```js
import { utf16fromString, utf16toString } from '@exodus/bytes/utf16.js'

// loose
import { utf16fromStringLoose, utf16toStringLoose } from '@exodus/bytes/utf16.js'
```

##### `utf16fromString(str, format = 'uint16')`
##### `utf16fromStringLoose(str, format = 'uint16')`
##### `utf16toString(arr, 'uint16')`
##### `utf16toStringLoose(arr, 'uint16')`

### `@exodus/bytes/single-byte.js`

```js
import { createSinglebyteDecoder, createSinglebyteEncoder } from '@exodus/bytes/single-byte.js'
import { windows1252toString, windows1252fromString } from '@exodus/bytes/single-byte.js'
```

Decode / encode the legacy single-byte encodings according to the
[Encoding standard](https://encoding.spec.whatwg.org/)
([§9](https://encoding.spec.whatwg.org/#legacy-single-byte-encodings),
[§14.5](https://encoding.spec.whatwg.org/#x-user-defined)),
and [unicode.org](https://unicode.org/Public/MAPPINGS/ISO8859) `iso-8859-*` mappings.

Supports all single-byte encodings listed in the WHATWG Encoding standard:
`ibm866`, `iso-8859-2`, `iso-8859-3`, `iso-8859-4`, `iso-8859-5`, `iso-8859-6`, `iso-8859-7`, `iso-8859-8`,
`iso-8859-8-i`, `iso-8859-10`, `iso-8859-13`, `iso-8859-14`, `iso-8859-15`, `iso-8859-16`, `koi8-r`, `koi8-u`,
`macintosh`, `windows-874`, `windows-1250`, `windows-1251`, `windows-1252`, `windows-1253`, `windows-1254`,
`windows-1255`, `windows-1256`, `windows-1257`, `windows-1258`, `x-mac-cyrillic` and `x-user-defined`.

Also supports `iso-8859-1`, `iso-8859-9`, `iso-8859-11` as defined at
[unicode.org](https://unicode.org/Public/MAPPINGS/ISO8859)
(and all other `iso-8859-*` encodings there as they match WHATWG).

> [!NOTE]
> While all `iso-8859-*` encodings supported by the [WHATWG Encoding standard](https://encoding.spec.whatwg.org/) match
> [unicode.org](https://unicode.org/Public/MAPPINGS/ISO8859), the WHATWG Encoding spec doesn't support
> `iso-8859-1`, `iso-8859-9`, `iso-8859-11`, and instead maps them as labels to `windows-1252`, `windows-1254`, `windows-874`.\
> `createSinglebyteDecoder()` (unlike `TextDecoder` or `legacyHookDecode()`) does not do such mapping,
> so its results will differ from `TextDecoder` for those encoding names.

```js
> new TextDecoder('iso-8859-1').encoding
'windows-1252'
> new TextDecoder('iso-8859-9').encoding
'windows-1254'
> new TextDecoder('iso-8859-11').encoding
'windows-874'
> new TextDecoder('iso-8859-9').decode(Uint8Array.of(0x80, 0x81, 0xd0))
'€\x81Ğ' // this is actually decoded according to windows-1254 per TextDecoder spec
> createSinglebyteDecoder('iso-8859-9')(Uint8Array.of(0x80, 0x81, 0xd0))
'\x80\x81Ğ' // this is iso-8859-9 as defined at https://unicode.org/Public/MAPPINGS/ISO8859/8859-9.txt
```

##### `createSinglebyteDecoder(encoding, loose = false)`

Create a decoder for a supported one-byte `encoding`, given its lowercased name `encoding`.

Returns a function `decode(arr)` that decodes bytes to a string.

##### `createSinglebyteEncoder(encoding, { mode = 'fatal' })`

Create an encoder for a supported one-byte `encoding`, given its lowercased name `encoding`.

Returns a function `encode(string)` that encodes a string to bytes.

In `'fatal'` mode (default), will throw on non well-formed strings or any codepoints which could
not be encoded in the target encoding.

##### `latin1toString(arr)`

Decode `iso-8859-1` bytes to a string.

There is no loose variant for this encoding, all bytes can be decoded.

Same as:
```js
const latin1toString = createSinglebyteDecoder('iso-8859-1')
```

Note: this is different from `new TextDecoder('iso-8859-1')` and `new TextDecoder('latin1')`, as
those alias to `new TextDecoder('windows-1252')`.

##### `latin1fromString(string)`

Encode a string to `iso-8859-1` bytes.

Will throw on non well-formed strings or any codepoints which could not be encoded in `iso-8859-1`.

Same as:
```js
const latin1fromString = createSinglebyteEncoder('iso-8859-1', { mode: 'fatal' })
```

##### `windows1252toString(arr)`

Decode `windows-1252` bytes to a string.

There is no loose variant for this encoding, all bytes can be decoded.

Same as:
```js
const windows1252toString = createSinglebyteDecoder('windows-1252')
```

##### `windows1252fromString(string)`

Encode a string to `windows-1252` bytes.

Will throw on non well-formed strings or any codepoints which could not be encoded in `windows-1252`.

Same as:
```js
const windows1252fromString = createSinglebyteEncoder('windows-1252', { mode: 'fatal' })
```

### `@exodus/bytes/multi-byte.js`

```js
import { createMultibyteDecoder } from '@exodus/bytes/multi-byte.js'
```

Decode the legacy multi-byte encodings according to the [Encoding standard](https://encoding.spec.whatwg.org/)
([§10](https://encoding.spec.whatwg.org/#legacy-multi-byte-chinese-(simplified)-encodings),
[§11](https://encoding.spec.whatwg.org/#legacy-multi-byte-chinese-(traditional)-encodings),
[§12](https://encoding.spec.whatwg.org/#legacy-multi-byte-japanese-encodings),
[§13](https://encoding.spec.whatwg.org/#legacy-multi-byte-korean-encodings)).

Supports all legacy multi-byte encodings listed in the standard:
`gbk`, `gb18030`, `big5`, `euc-jp`, `iso-2022-jp`, `shift_jis`, `euc-kr`.

##### `createMultibyteDecoder(encoding, loose = false)`

Create a decoder for a supported legacy multi-byte `encoding`, given its lowercased name `encoding`.

Returns a function `decode(arr, stream = false)` that decodes bytes to a string.

That function will have state while `stream = true` is used.

### `@exodus/bytes/bigint.js`

```js
import { fromBigInt, toBigInt } from '@exodus/bytes/bigint.js'
```

##### `fromBigInt(bigint, { length, format = 'uint8' })`
##### `toBigInt(arr)`

### `@exodus/bytes/hex.js`

Implements Base16 from [RFC4648](https://datatracker.ietf.org/doc/html/rfc4648) (no differences from [RFC3548](https://datatracker.ietf.org/doc/html/rfc4648)).

```js
import { fromHex, toHex } from '@exodus/bytes/hex.js'
```

##### `fromHex(string)`
##### `toHex(arr)`

### `@exodus/bytes/base64.js`

Implements Base64 from [RFC4648](https://datatracker.ietf.org/doc/html/rfc4648) (no differences from [RFC3548](https://datatracker.ietf.org/doc/html/rfc4648)).

```js
import { fromBase64, toBase64 } from '@exodus/bytes/base64.js'
import { fromBase64url, toBase64url } from '@exodus/bytes/base64.js'
import { fromBase64any } from '@exodus/bytes/base64.js'
```

##### `fromBase64(str, { format = 'uint8', padding = 'both' })`
##### `fromBase64url(str, { format = 'uint8', padding = false })`
##### `fromBase64any(str, { format = 'uint8', padding = 'both' })`
##### `toBase64(arr, { padding = true })`
##### `toBase64url(arr, { padding = false })`

### `@exodus/bytes/base32.js`

Implements Base32 from [RFC4648](https://datatracker.ietf.org/doc/html/rfc4648) (no differences from [RFC3548](https://datatracker.ietf.org/doc/html/rfc4648)).

```js
import { fromBase32, toBase32 } from '@exodus/bytes/base32.js'
import { fromBase32hex, toBase32hex } from '@exodus/bytes/base32.js'
```

##### `fromBase32(str, { format = 'uint8', padding = 'both' })`
##### `fromBase32hex(str, { format = 'uint8', padding = 'both' })`
##### `toBase32(arr, { padding = false })`
##### `toBase32hex(arr, { padding = false })`

### `@exodus/bytes/bech32.js`

Implements [BIP-0173](https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki#specification) and [BIP-0350](https://github.com/bitcoin/bips/blob/master/bip-0350.mediawiki#specification).

```js
import { fromBech32, toBech32 } from '@exodus/bytes/bech32.js'
import { fromBech32m, toBech32m } from '@exodus/bytes/base32.js'
import { getPrefix } from '@exodus/bytes/base32.js'
```

##### `getPrefix(str, limit = 90)`

##### `fromBech32(str, limit = 90)`
##### `toBech32(prefix, bytes, limit = 90)`

##### `fromBech32m(str, limit = 90)`
##### `toBech32m(prefix, bytes, limit = 90)`

### `@exodus/bytes/base58.js`

```js
import { fromBase58, toBase58 } from '@exodus/bytes/base58.js'
import { fromBase58xrp, toBase58xrp } from '@exodus/bytes/base58.js'
```

##### `fromBase58(str, format = 'uint8')`
##### `toBase58(arr)`

##### `fromBase58xrp(str, format = 'uint8')`
##### `toBase58xrp(arr)`

### `@exodus/bytes/base58check.js`

```js
import { fromBase58check, toBase58check } from '@exodus/bytes/base58check.js'
import { fromBase58checkSync, toBase58checkSync } from '@exodus/bytes/base58check.js'
import { makeBase58check } from '@exodus/bytes/base58check.js'
```

On non-Node.js, requires peer dependency [@exodus/crypto](https://www.npmjs.com/package/@exodus/crypto) to be installed.

##### `async fromBase58check(str, format = 'uint8')`
##### `async toBase58check(arr)`
##### `fromBase58checkSync(str, format = 'uint8')`
##### `toBase58checkSync(arr)`
##### `makeBase58check(hashAlgo, hashAlgoSync)`

### `@exodus/bytes/wif.js`

```js
import { fromWifString, toWifString } from '@exodus/bytes/wif.js'
import { fromWifStringSync, toWifStringSync } from '@exodus/bytes/wif.js'
```

On non-Node.js, requires peer dependency [@exodus/crypto](https://www.npmjs.com/package/@exodus/crypto) to be installed.

##### `async fromWifString(string, version)`
##### `fromWifStringSync(string, version)`
##### `async toWifString({ version, privateKey, compressed })`
##### `toWifStringSync({ version, privateKey, compressed })`

### `@exodus/bytes/encoding.js`

```js
import { TextDecoder, TextEncoder } from '@exodus/bytes/encoding.js'
import { TextDecoderStream, TextEncoderStream } from '@exodus/bytes/encoding.js' // Requires Streams

// Hooks for standards
import { getBOMEncoding, legacyHookDecode, labelToName, normalizeEncoding } from '@exodus/bytes/encoding.js'
```

Implements the [Encoding standard](https://encoding.spec.whatwg.org/):
[TextDecoder](https://encoding.spec.whatwg.org/#interface-textdecoder),
[TextEncoder](https://encoding.spec.whatwg.org/#interface-textencoder),
[TextDecoderStream](https://encoding.spec.whatwg.org/#interface-textdecoderstream),
[TextEncoderStream](https://encoding.spec.whatwg.org/#interface-textencoderstream),
some [hooks](https://encoding.spec.whatwg.org/#specification-hooks) (see below).

#### `new TextDecoder(label = 'utf-8', { fatal = false, ignoreBOM = false })`

[TextDecoder](https://encoding.spec.whatwg.org/#interface-textdecoder) implementation/polyfill.

#### `new TextEncoder()`

[TextEncoder](https://encoding.spec.whatwg.org/#interface-textencoder) implementation/polyfill.

#### `new TextDecoderStream(label = 'utf-8', { fatal = false, ignoreBOM = false })`

[TextDecoderStream](https://encoding.spec.whatwg.org/#interface-textdecoderstream) implementation/polyfill.

Requires [Streams](https://streams.spec.whatwg.org/) to be either supported by the platform or
[polyfilled](https://npmjs.com/package/web-streams-polyfill).

#### `new TextEncoderStream()`

[TextEncoderStream](https://encoding.spec.whatwg.org/#interface-textencoderstream) implementation/polyfill.

Requires [Streams](https://streams.spec.whatwg.org/) to be either supported by the platform or
[polyfilled](https://npmjs.com/package/web-streams-polyfill).

#### `labelToName(label)`

Implements [get an encoding from a string `label`](https://encoding.spec.whatwg.org/#concept-encoding-get).

Converts an encoding [label](https://encoding.spec.whatwg.org/#names-and-labels) to its name,
as a case-sensitive string.

If an encoding with that label does not exist, returns `null`.

All encoding names are also valid labels for corresponding encodings.

#### `normalizeEncoding(label)`

Converts an encoding [label](https://encoding.spec.whatwg.org/#names-and-labels) to its name,
as an ASCII-lowercased string.

If an encoding with that label does not exist, returns `null`.

This is the same as [`decoder.encoding` getter](https://encoding.spec.whatwg.org/#dom-textdecoder-encoding),
except that it:
 1. Supports [`replacement` encoding](https://encoding.spec.whatwg.org/#replacement) and its
    [labels](https://encoding.spec.whatwg.org/#ref-for-replacement%E2%91%A1)
 2. Does not throw for invalid labels and instead returns `null`

It is identical to:
```js
labelToName(label)?.toLowerCase() ?? null
```

All encoding names are also valid labels for corresponding encodings.

#### `getBOMEncoding(input)`

Implements [BOM sniff](https://encoding.spec.whatwg.org/#bom-sniff) legacy hook.

Given a `TypedArray` or an `ArrayBuffer` instance `input`, returns either of:
* `'utf-8'`, if `input` starts with UTF-8 byte order mark.
* `'utf-16le'`, if `input` starts with UTF-16LE byte order mark.
* `'utf-16be'`, if `input` starts with UTF-16BE byte order mark.
* `null` otherwise.

#### `legacyHookDecode(input, fallbackEncoding = 'utf-8')`

Implements [decode](https://encoding.spec.whatwg.org/#decode) legacy hook.

Given a `TypedArray` or an `ArrayBuffer` instance `input` and an optional `fallbackEncoding`
encoding [label](https://encoding.spec.whatwg.org/#names-and-labels),
sniffs encoding from BOM with `fallbackEncoding` fallback and then
decodes the `input` using that encoding, skipping BOM if it was present.

Notes:

 * BOM-sniffed encoding takes precedence over `fallbackEncoding` option per spec.
   Use with care.
 * Always operates in non-fatal [mode](https://encoding.spec.whatwg.org/#textdecoder-error-mode),
   aka replacement. It can convert different byte sequences to equal strings.

This method is similar to the following code, except that it doesn't support encoding labels and
only expects lowercased encoding name:

```js
new TextDecoder(getBOMEncoding(input) ?? fallbackEncoding).decode(input)
```

### `@exodus/bytes/encoding-lite.js`

```js
import { TextDecoder, TextEncoder } from '@exodus/bytes/encoding-lite.js'
import { TextDecoderStream, TextEncoderStream } from '@exodus/bytes/encoding-lite.js' // Requires Streams

// Hooks for standards
import { getBOMEncoding, legacyHookDecode, labelToName, normalizeEncoding } from '@exodus/bytes/encoding-lite.js'
```

The exact same exports as `@exodus/bytes/encoding.js` are also exported as
`@exodus/bytes/encoding-lite.js`, with the difference that the lite version does not load
multi-byte `TextDecoder` encodings by default to reduce bundle size 10x.

The only affected encodings are: `gbk`, `gb18030`, `big5`, `euc-jp`, `iso-2022-jp`, `shift_jis`
and their [labels](https://encoding.spec.whatwg.org/#names-and-labels) when used with `TextDecoder`.

Legacy single-byte encodingds are loaded by default in both cases.

`TextEncoder` and hooks for standards (including `labelToName` / `normalizeEncoding`) do not have any behavior
differences in the lite version and support full range if inputs.

To avoid inconsistencies, the exported classes and methods are exactly the same objects.

```console
> lite = require('@exodus/bytes/encoding-lite.js')
[Module: null prototype] {
  TextDecoder: [class TextDecoder],
  TextDecoderStream: [class TextDecoderStream],
  TextEncoder: [class TextEncoder],
  TextEncoderStream: [class TextEncoderStream],
  getBOMEncoding: [Function: getBOMEncoding],
  labelToName: [Function: labelToName],
  legacyHookDecode: [Function: legacyHookDecode],
  normalizeEncoding: [Function: normalizeEncoding]
}
> new lite.TextDecoder('big5').decode(Uint8Array.of(0x25))
Uncaught:
Error: Legacy multi-byte encodings are disabled in /encoding-lite.js, use /encoding.js for full encodings range support

> full = require('@exodus/bytes/encoding.js')
[Module: null prototype] {
  TextDecoder: [class TextDecoder],
  TextDecoderStream: [class TextDecoderStream],
  TextEncoder: [class TextEncoder],
  TextEncoderStream: [class TextEncoderStream],
  getBOMEncoding: [Function: getBOMEncoding],
  labelToName: [Function: labelToName],
  legacyHookDecode: [Function: legacyHookDecode],
  normalizeEncoding: [Function: normalizeEncoding]
}
> full.TextDecoder === lite.TextDecoder
true
> new full.TextDecoder('big5').decode(Uint8Array.of(0x25))
'%'
> new lite.TextDecoder('big5').decode(Uint8Array.of(0x25))
'%'
```

## License

[MIT](./LICENSE)
