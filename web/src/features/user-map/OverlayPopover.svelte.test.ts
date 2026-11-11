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
  volumes: 1,
  secondsPerVolume: null,
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

test('links its methods page, which it says is in English', async () => {
  await opened(summary);
  await userEvent.click(page.getByText('À propos de ces données'));
  const methods = page.getByRole('link', {
    name: 'Méthode et limites (en anglais) (s’ouvre dans un nouvel onglet)',
    exact: true,
  });
  await expect.element(methods).toHaveAttribute('href', '/docs/features/overlays.html');
  await expect.element(methods).toHaveAttribute('hreflang', 'en');
});

test('a file that cannot be read is explained in French', async () => {
  await opened(new MapFileError('tooManyVolumes', [300, 61]));
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent(`${fr.failed('zstat1.nii')} ${fr.reasons.tooManyVolumes(300, 61)}`);
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

test('a series offers its volumes by time, and plays once it is drawn', async () => {
  const map = await opened({ ...summary, volumes: 20, secondsPerVolume: 1.5 });
  const slider = page.getByRole('slider', { name: fr.volume });
  await expect.element(slider).toHaveAttribute('aria-valuetext', fr.volumeOf('1', '20', '0 s'));
  const play = page.getByRole('button', { name: fr.play });
  await expect.element(play).toBeDisabled();
  await userEvent.type(page.getByLabelText(fr.threshold), '3');
  await expect.element(play).toBeEnabled();
  await userEvent.click(play);
  expect(map.playing).toBe(true);
  await userEvent.click(page.getByRole('button', { name: fr.pause }));
  expect(map.playing).toBe(false);
  map.setVolume(4);
  await expect.element(slider).toHaveAttribute('aria-valuetext', fr.volumeOf('5', '20', '6 s'));
});

test('a single map has no volume control', async () => {
  await opened(summary);
  await expect.element(page.getByRole('slider', { name: fr.volume })).not.toBeInTheDocument();
});

test('what is adjusted while looking comes first; what is set once folds under a line naming it', async () => {
  const map = await opened(summary);
  const at = (locator: { element: () => Element }) => locator.element();
  const follows = (a: Element, b: Element) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const show = at(page.getByRole('switch', { name: fr.show }));
  const threshold = at(page.getByLabelText(fr.threshold, { exact: true }));
  const opacity = at(page.getByRole('slider', { name: fr.opacity }));
  const settings = at(page.getByText(fr.settings, { exact: true })).closest('details')!;
  expect([
    follows(show, threshold),
    follows(threshold, opacity),
    follows(opacity, settings),
  ]).toEqual([true, true, true]);
  expect(settings.open).toBe(false);
  for (const label of [fr.space, fr.title, fr.statistic, fr.minVoxels, fr.surface]) {
    expect(settings.contains(at(page.getByLabelText(label, { exact: true }))), label).toBe(true);
  }
  const unstated = t('fr', 'coordinate').unstated;
  // The file's intent says z.
  const line = page.getByText(fr.settingsLine(unstated, 'z', fr.everyCluster, 'piale'));
  await expect.element(line).toBeVisible();

  // The line follows what is chosen, and gives way to the fields while they are open.
  map.setStatistic(null);
  map.setMinVoxels(10);
  const changed = fr.settingsLine(unstated, fr.value, fr.captionMinVoxels('10'), 'piale');
  await expect.element(page.getByText(changed)).toBeVisible();
  await userEvent.click(page.getByText(fr.settings, { exact: true }));
  await expect.element(page.getByLabelText(fr.space, { exact: true })).toBeVisible();
  await expect.element(page.getByText(changed)).not.toBeInTheDocument();
});
