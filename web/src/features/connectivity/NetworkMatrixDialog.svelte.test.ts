// The network matrix dialog: its file once, its cells in their colours, the pair under the pointer,
// the networks' means, and a saved figure.
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import published from '../../../../public/models/cdmd/network-connectivity.json';
import { networks } from '../../../../public/models/cdmd/manifest.json';
import { cellColour, pairR, readNetworkMatrix } from '../../lib/core/catalog/network-matrix.ts';
import { networkName } from '../../lib/core/catalog/networks.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import { expectAxeCleanOnce } from '../../lib/ui/a11y-test-support.ts';
import type { Rgb } from '../../lib/types/index.ts';
import '../../styles/index.css';
import { DIAGONAL } from './network-matrix-draw.ts';
import NetworkMatrixDialog from './NetworkMatrixDialog.svelte';

const fetchAsset = vi.hoisted(() => vi.fn<(url: URL) => Promise<ArrayBuffer>>());
vi.mock('../../lib/core/assets/asset-cache.ts', () => ({ fetchAsset }));
afterAll(() => {
  vi.resetModules();
});

const matrix = readNetworkMatrix(structuredClone(published), networks.networks);
const YEO = {
  networks: networks.networks,
  colors: networks.colors as unknown as Record<string, Rgb>,
};
let detach: () => void;
beforeEach(() => {
  const region = document.body.appendChild(document.createElement('div'));
  region.setAttribute('aria-live', 'polite');
  detach = attachAnnouncer(region);
  fetchAsset.mockReset();
  fetchAsset.mockImplementation(
    async () => new TextEncoder().encode(JSON.stringify(published)).buffer,
  );
});
afterEach(() => {
  detach();
  cleanup();
});

const props = (open: boolean) => ({
  open,
  lang: 'en' as const,
  url: new URL('https://example.test/network-connectivity.json'),
  networks: YEO,
  fallbackFocus: () => null,
});
const dialog = () => document.querySelector<HTMLDialogElement>('dialog[open]');
const loaded = () =>
  expect.poll(() => dialog()?.querySelector('canvas')?.width).toBe(matrix.parcels.length);

describe('NETM-04 the network matrix dialog', () => {
  test('downloads its file the first time it opens, and only then', async () => {
    const view = await render(NetworkMatrixDialog, props(false));
    expect(fetchAsset).not.toHaveBeenCalled();
    await view.rerender(props(true));
    await loaded();
    await view.rerender(props(false));
    await view.rerender(props(true));
    await loaded();
    expect(fetchAsset).toHaveBeenCalledTimes(1);
  });

  test('draws each pair in the key’s colour for its r, and a parcel with itself grey', async () => {
    await render(NetworkMatrixDialog, props(true));
    await loaded();
    const context = dialog()!.querySelector('canvas')!.getContext('2d')!;
    const pixel = (i: number, j: number) =>
      Array.from(context.getImageData(j, i, 1, 1).data.subarray(0, 3));
    for (const [i, j] of [
      [0, 1],
      [3, 150],
      [120, 40],
      [199, 0],
    ] as const) {
      expect(pixel(i, j), `${i}, ${j}`).toEqual(cellColour(matrix, pairR(matrix, i, j)!));
    }
    expect(pixel(77, 77)).toEqual(DIAGONAL);
  });

  test('names the pair under the pointer and its r', async () => {
    await render(NetworkMatrixDialog, props(true));
    await loaded();
    const canvas = dialog()!.querySelector('canvas')!;
    const box = canvas.getBoundingClientRect();
    const n = matrix.parcels.length;
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: box.left + (150.5 * box.width) / n,
        clientY: box.top + (3.5 * box.height) / n,
        bubbles: true,
      }),
    );
    const named = (index: number) => {
      const { network, name, hemisphere } = matrix.parcels[index]!;
      return `${networkName(network)} ${name}, ${hemisphere}`;
    };
    await expect
      .poll(() => dialog()!.querySelector('.matrix-readout')!.textContent)
      .toBe(`${named(3)} with ${named(150)}: r ${pairR(matrix, 3, 150)!.toFixed(2)}`);
    canvas.dispatchEvent(new PointerEvent('pointerleave'));
    await expect
      .poll(() => dialog()!.querySelector('.matrix-readout')!.textContent)
      .toBe('Point at a cell to read its correlation.');
  });

  test('tables the networks’ means, and says which network forms no block and why', async () => {
    await render(NetworkMatrixDialog, props(true));
    await loaded();
    const rows = [...dialog()!.querySelectorAll('tbody tr')];
    expect(rows.map((row) => [...row.querySelectorAll('td')].map((td) => td.textContent))).toEqual(
      matrix.blocks.map((values) => values.map((value) => value.toFixed(2))),
    );
    expect(rows.map((row) => row.querySelector('td.within')!.textContent)).toEqual(
      matrix.blocks.map((values, k) => values[k]!.toFixed(2)),
    );
    expect(rows.filter((row) => row.hasAttribute('data-apart'))).toHaveLength(1);
    const notes = [...dialog()!.querySelectorAll('.matrix-side p')].map((p) => p.textContent);
    expect(notes).toContain(
      'Each network but Limbic correlates more within itself than with any other: its block on the diagonal is the brightest of its row.',
    );
    expect(
      notes.some((note) => note!.startsWith('Limbic parcels lie where fMRI loses signal')),
    ).toBe(true);
    expect(notes).toContain(
      'Without global signal regression nearly every pair is positive (99.4% here). A correlation is not a connection.',
    );
  });

  test('saves the matrix as a PNG figure', async () => {
    await render(NetworkMatrixDialog, props(true));
    await loaded();
    const saved: { download: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push({ download: this.download, href: this.href });
    });
    dialog()!.querySelector<HTMLButtonElement>('.matrix-save')!.click();
    expect(saved).toHaveLength(1);
    expect(saved[0]!.download).toBe('network-matrix.png');
    const image = new Image();
    image.src = saved[0]!.href;
    await image.decode();
    // The 600-pixel matrix, its strips and names, title and scale.
    expect(image.naturalWidth).toBeGreaterThan(600);
    expect(image.naturalHeight).toBeGreaterThan(600);
    vi.restoreAllMocks();
  });

  test('says so when its file fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchAsset.mockImplementation(async () => {
      throw new Error('offline');
    });
    await render(NetworkMatrixDialog, props(true));
    await expect
      .poll(() => dialog()?.querySelector('[role="alert"]')?.textContent)
      .toBe('The matrix could not be loaded.');
    vi.restoreAllMocks();
  });

  test('axe finds nothing in the open dialog', async () => {
    await render(NetworkMatrixDialog, props(true));
    await loaded();
    await expectAxeCleanOnce('dark', 1280);
  });
});
