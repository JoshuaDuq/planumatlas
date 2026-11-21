import { createHash } from 'node:crypto';
import { onTestFinished } from 'vitest';
import PUBLISHED, { type PublishedRecord } from './published-files.ts';

/** Test-only helpers: publish a file map for the test, and put the unpublished state back after it. */

export const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

// Per test, not a module-level afterEach: the unit files share one module cache (isolate: false), so
// a hook registered on import would reach only the first file to import this.
export function publish(files: Record<string, PublishedRecord>): void {
  Object.assign(PUBLISHED, { base: '/neuroatlas/', files });
  onTestFinished(() => {
    Object.assign(PUBLISHED, { base: '/', files: null });
  });
}

export function recordOf(bytes: Uint8Array): PublishedRecord {
  const digest = sha256(bytes);
  return { sha256: digest, size: bytes.byteLength };
}
