import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  // TODO: Re-enable twMerge after migration to tailwind v4
  // Doesn't support de-duplicating custom classes, eg text-brand and text-base
  return clsx(inputs);
}

export function formatBytes(bytes: bigint | null | undefined): string {
  if (bytes === null || bytes === undefined) return '';
  const num = Number(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatFileSize(bytes: bigint | null | undefined): string {
  return formatBytes(bytes);
}
