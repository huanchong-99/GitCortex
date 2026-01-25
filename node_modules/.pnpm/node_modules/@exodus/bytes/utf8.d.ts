/// <reference types="node" />

import type { OutputFormat, Uint8ArrayBuffer } from './array.js';

/**
 * Encodes a string to UTF-8 bytes (strict mode)
 * Throws on invalid Unicode (unpaired surrogates)
 * @param str - The string to encode
 * @param format - Output format (default: 'uint8')
 * @returns The encoded bytes
 */
export function utf8fromString(str: string, format?: 'uint8'): Uint8ArrayBuffer;
export function utf8fromString(str: string, format: 'buffer'): Buffer;
export function utf8fromString(str: string, format?: OutputFormat): Uint8ArrayBuffer | Buffer;

/**
 * Encodes a string to UTF-8 bytes (loose mode)
 * Replaces invalid Unicode with replacement character
 * @param str - The string to encode
 * @param format - Output format (default: 'uint8')
 * @returns The encoded bytes
 */
export function utf8fromStringLoose(str: string, format?: 'uint8'): Uint8ArrayBuffer;
export function utf8fromStringLoose(str: string, format: 'buffer'): Buffer;
export function utf8fromStringLoose(str: string, format?: OutputFormat): Uint8ArrayBuffer | Buffer;

/**
 * Decodes UTF-8 bytes to a string (strict mode)
 * Throws on invalid UTF-8 sequences
 * @param arr - The bytes to decode
 * @returns The decoded string
 */
export function utf8toString(arr: Uint8ArrayBuffer): string;

/**
 * Decodes UTF-8 bytes to a string (loose mode)
 * Replaces invalid sequences with replacement character
 * @param arr - The bytes to decode
 * @returns The decoded string
 */
export function utf8toStringLoose(arr: Uint8ArrayBuffer): string;

