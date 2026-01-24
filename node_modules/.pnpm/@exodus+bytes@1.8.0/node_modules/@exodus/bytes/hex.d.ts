/// <reference types="node" />

import type { OutputFormat, Uint8ArrayBuffer } from './array.js';

/**
 * Encodes a Uint8Array to a lowercase hex string
 * @param arr - The input bytes
 * @returns The hex encoded string
 */
export function toHex(arr: Uint8ArrayBuffer): string;

/**
 * Decodes a hex string to bytes
 * Unlike Buffer.from(), throws on invalid input
 * @param str - The hex encoded string (case-insensitive)
 * @param format - Output format (default: 'uint8')
 * @returns The decoded bytes
 */
export function fromHex(str: string, format?: 'uint8'): Uint8ArrayBuffer;
export function fromHex(str: string, format: 'buffer'): Buffer;
export function fromHex(str: string, format?: OutputFormat): Uint8ArrayBuffer | Buffer;

