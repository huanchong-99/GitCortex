/// <reference types="node" />

import type { OutputFormat, Uint8ArrayBuffer } from './array.js';

/**
 * Options for base64 encoding
 */
export interface ToBase64Options {
  /** Whether to include padding characters (default: true for base64, false for base64url) */
  padding?: boolean;
}

/**
 * Padding mode for base64 decoding
 * - true: padding is required
 * - false: padding is not allowed
 * - 'both': padding is optional (default for base64)
 */
export type PaddingMode = boolean | 'both';

/**
 * Options for base64 decoding
 */
export interface FromBase64Options {
  /** Output format (default: 'uint8') */
  format?: OutputFormat;
  /** Padding mode */
  padding?: PaddingMode;
}

/**
 * Encodes a Uint8Array to a base64 string (RFC 4648)
 * @param arr - The input bytes
 * @param options - Encoding options
 * @returns The base64 encoded string
 */
export function toBase64(arr: Uint8ArrayBuffer, options?: ToBase64Options): string;

/**
 * Encodes a Uint8Array to a base64url string (RFC 4648)
 * @param arr - The input bytes
 * @param options - Encoding options (padding defaults to false)
 * @returns The base64url encoded string
 */
export function toBase64url(arr: Uint8ArrayBuffer, options?: ToBase64Options): string;

/**
 * Decodes a base64 string to bytes
 * Operates in strict mode for last chunk, does not allow whitespace
 * @param str - The base64 encoded string
 * @param options - Decoding options
 * @returns The decoded bytes
 */
export function fromBase64(str: string, options?: FromBase64Options): Uint8ArrayBuffer;
export function fromBase64(str: string, options: FromBase64Options & { format: 'buffer' }): Buffer;

/**
 * Decodes a base64url string to bytes
 * Operates in strict mode for last chunk, does not allow whitespace
 * @param str - The base64url encoded string
 * @param options - Decoding options (padding defaults to false)
 * @returns The decoded bytes
 */
export function fromBase64url(str: string, options?: FromBase64Options): Uint8ArrayBuffer;
export function fromBase64url(str: string, options: FromBase64Options & { format: 'buffer' }): Buffer;

/**
 * Decodes either base64 or base64url string to bytes
 * Automatically detects the variant based on characters present
 * @param str - The base64 or base64url encoded string
 * @param options - Decoding options
 * @returns The decoded bytes
 */
export function fromBase64any(str: string, options?: FromBase64Options): Uint8ArrayBuffer;
export function fromBase64any(str: string, options: FromBase64Options & { format: 'buffer' }): Buffer;

