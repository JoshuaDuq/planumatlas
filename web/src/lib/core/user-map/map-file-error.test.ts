import assert from 'node:assert/strict';
import { test } from 'vitest';
import { AssetError } from '../assets/published-assets.ts';
import { t } from '../i18n/index.ts';
import { MapFileError, mapFileReason } from './map-file-error.ts';
import { readNifti } from './nifti.ts';

const fr = t('fr', 'overlay');
const frErrors = t('fr', 'errors');

test('a file that cannot be read is worded in French from its code, after crossing to the page', async () => {
  const error = await readNifti(new TextEncoder().encode('not an image').buffer).catch(
    (thrown: unknown) => thrown,
  );
  assert.ok(error instanceof MapFileError);
  assert.equal(error.message, 'This file is not a NIfTI image.');
  // What the worker posts is cloned; the page builds the error again from it.
  const { code, params } = structuredClone({ code: error.code, params: error.params });
  assert.equal(mapFileReason(fr, frErrors, new MapFileError(code, params)), fr.reasons.notNifti);
});

test('a reason with values words them in the reader’s language', () => {
  const posted = structuredClone({ code: 'tooManyVolumes' as const, params: [300, 1234] });
  assert.equal(
    mapFileReason(fr, frErrors, new MapFileError(posted.code, posted.params)),
    'Ce fichier contient 300 volumes ; jusqu’à 1\u202f234 de cette taille peuvent être affichés. Enregistrez-en moins dans leur propre fichier.',
  );
  assert.equal(
    new MapFileError('tooManyVolumes', [300, 1234]).message,
    'This file holds 300 volumes; up to 1\u202f234 of its size can be shown. Save fewer as their own file.',
  );
});

test('a failed download or a newer deploy is said as the app says it elsewhere', () => {
  const fetch = new AssetError('asset-fetch', 'Asset request failed: HTTP 503');
  const updated = new AssetError('asset-updated', 'Published file changed');
  assert.equal(mapFileReason(fr, frErrors, fetch), frErrors.download);
  assert.equal(mapFileReason(fr, frErrors, updated), frErrors.updated);
});

test('an unexpected error is said to be unexpected, never in another language', () => {
  assert.equal(
    mapFileReason(fr, frErrors, new Error('No inverted field or cortex for x.')),
    fr.unexpected,
  );
});

test('a reason given the wrong number of values fails rather than saying undefined', () => {
  assert.throws(() => new MapFileError('dimensions', []), /takes 1 values, not 0/);
});
