/// <reference types="node" />

/**
 * Converts an encoding label to its name, as an ASCII-lowercased string
 * @param label - The encoding label to normalize
 * @returns The normalized encoding name, or null if invalid
 */
export function normalizeEncoding(label: string): string | null;

/**
 * Implements BOM sniff (https://encoding.spec.whatwg.org/#bom-sniff) legacy hook.
 * @param input - The bytes to check for BOM
 * @returns The encoding ('utf-8', 'utf-16le', 'utf-16be'), or null if no BOM found
 */
export function getBOMEncoding(
  input: ArrayBufferLike | ArrayBufferView
): 'utf-8' | 'utf-16le' | 'utf-16be' | null;

/**
 * Implements decode (https://encoding.spec.whatwg.org/#decode) legacy hook.
 * @param input - The bytes to decode
 * @param fallbackEncoding - The encoding to use if no BOM detected (default: 'utf-8')
 * @returns The decoded string
 */
export function legacyHookDecode(
  input: ArrayBufferLike | ArrayBufferView,
  fallbackEncoding?: string
): string;

/**
 * Converts an encoding label to its name, as a case-sensitive string.
 * @param label - The encoding label
 * @returns The proper case encoding name, or null if invalid
 */
export function labelToName(label: string): string | null;

/**
 * Text decoder for decoding bytes to strings in various encodings
 * Supports strict and lossy modes
 */
export const TextDecoder: typeof globalThis.TextDecoder;

/**
 * Text encoder for encoding strings to UTF-8 bytes
 */
export const TextEncoder: typeof globalThis.TextEncoder;

/**
 * Transform stream wrapper for TextDecoder
 * Decodes chunks of bytes to strings
 */
export const TextDecoderStream: typeof globalThis.TextDecoderStream;

/**
 * Transform stream wrapper for TextEncoder
 * Encodes chunks of strings to UTF-8 bytes
 */
export const TextEncoderStream: typeof globalThis.TextEncoderStream;
