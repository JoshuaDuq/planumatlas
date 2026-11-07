import type { en as errorsEn } from '../i18n/areas/errors.ts';
import { en } from '../i18n/areas/overlay.ts';

type Reasons = typeof en.reasons;

/** Why the reader's file cannot be read or placed, as the overlay copy words it. */
export type MapFileCode = keyof Reasons;

/**
 * A file the reader gave that cannot be drawn. Its code and params, the values its reason names, cross
 * the worker boundary; the message is the English reason, for the console.
 */
export class MapFileError extends Error {
  readonly code: MapFileCode;
  readonly params: readonly (string | number)[];

  constructor(
    code: MapFileCode,
    params: readonly (string | number)[] = [],
    options?: ErrorOptions,
  ) {
    super(reason(en.reasons, code, params), options);
    this.name = 'MapFileError';
    this.code = code;
    this.params = params;
  }
}

/**
 * What the reader is told about a failed file, in the language of `copy` and `errors`: a download that
 * failed or a newer deploy (an AssetError's code) as the app says them elsewhere, anything else as
 * unexpected.
 */
export function mapFileReason(
  copy: typeof en,
  errors: Pick<typeof errorsEn, 'download' | 'updated'>,
  error: unknown,
): string {
  if (error instanceof MapFileError) return reason(copy.reasons, error.code, error.params);
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'asset-fetch') return errors.download;
  if (code === 'asset-updated') return errors.updated;
  return copy.unexpected;
}

function reason(reasons: Reasons, code: MapFileCode, params: readonly unknown[]): string {
  const said = reasons[code] as string | ((...params: unknown[]) => string);
  const takes = typeof said === 'string' ? 0 : said.length;
  if (takes !== params.length) {
    throw new Error(`The ${code} reason takes ${takes} values, not ${params.length}.`);
  }
  return typeof said === 'string' ? said : said(...params);
}
