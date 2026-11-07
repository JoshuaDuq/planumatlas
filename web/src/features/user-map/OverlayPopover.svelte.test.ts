import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { AssetError } from '../../lib/core/assets/published-assets.ts';
import { t } from '../../lib/core/i18n/index.ts';
import type { MapSummary } from '../../lib/core/user-map/display.ts';
import { MapFileError } from '../../lib/core/user-map/map-file-error.ts';
import { createFakeUserMap } from '../../lib/engine/fake/user-map.ts';
import { createUserMapStore } from '../../lib/state/user-map.svelte.ts';
import type { CoordinateSpaces } from '../../lib/types/index.ts';
import OverlayPopover from './OverlayPopover.svelte';

const fr = t('fr', 'overlay');
const summary: MapSummary = {
  shape: [97, 115, 97],
  voxelMm: [2, 2, 2],
  range: [-5.2, 7.8],
  binary: false,
  intent: 5,
  description: '',
  cortexCovered: 0.99,
};
const spaces = {
  spaces: [{ id: 'mni', label: 'MNI', description: '' }],
  unstated: { reads_as: 'mni', alternatives: [] },
} as unknown as CoordinateSpaces;

afterEach(() => {
  cleanup();
});

async function opened(result: MapSummary | Error) {
  const engine = createFakeUserMap(true);
  const map = createUserMapStore({ engine, display: { color: 'atlas', setColor() {} } });
  await render(OverlayPopover, { map, spaces, lang: 'fr', onPlace() {} });
  const reading = map.open(new File([new Uint8Array(4)], 'zstat1.nii'));
  await expect.poll(() => engine.loading).toBe(true);
  engine.settle(result);
  await reading;
  return map;
}

test('Remove hands focus to the button that chooses another file', async () => {
  await opened(summary);
  const remove = page.getByRole('button', { name: fr.remove });
  await userEvent.click(remove);
  await expect.element(page.getByRole('button', { name: fr.choose })).toHaveFocus();
});

test('a file that cannot be read is explained in French', async () => {
  await opened(new MapFileError('volumes', [3]));
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent(`${fr.failed('zstat1.nii')} ${fr.reasons.volumes(3)}`);
});

test('an unexpected failure is said in French and left in the console', async () => {
  await opened(new Error('No inverted field or cortex for mni.'));
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent(`${fr.failed('zstat1.nii')} ${fr.unexpected}`);
});

test('a template field that could not be downloaded asks for the connection, in French', async () => {
  await opened(new AssetError('asset-fetch', 'Asset request failed: HTTP 503'));
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent(`${fr.failed('zstat1.nii')} ${t('fr', 'errors').download}`);
});
