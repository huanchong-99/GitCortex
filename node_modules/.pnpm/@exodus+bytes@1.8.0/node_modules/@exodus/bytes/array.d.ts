/// <reference types="node" />

// >= TypeScript 5.9 made Uint8Array templated with <> and defaulted to ArrayBufferLike
// which would incorrectly accept SharedArrayBuffer instances.
// < TypeScript 5.7 doesn't support templates for Uint8Array.
// So this type is defined as a workaround to evaluate to Uint8Array<ArrayBuffer> on all versions of TypeScript.
export type Uint8ArrayBuffer = ReturnType<typeof Uint8Array.from>;

/**
 * Output format for typed array conversions
 */
export type OutputFormat = 'uint8' | 'buffer';

/**
 * Creates a view of a TypedArray in the specified format
 * Note: This does not copy data - returns a view on the same underlying buffer
 * @param arr - The input TypedArray
 * @param format - The desired output format ('uint8' or 'buffer')
 * @returns A view on the same underlying buffer
 */
export function typedView(arr: ArrayBufferView, format: 'uint8'): Uint8Array;
export function typedView(arr: ArrayBufferView, format: 'buffer'): Buffer;
export function typedView(arr: ArrayBufferView, format: OutputFormat): Uint8Array | Buffer;

