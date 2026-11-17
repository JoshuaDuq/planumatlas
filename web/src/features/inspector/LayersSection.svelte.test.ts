import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import type { CorticalLayers } from '../../lib/core/catalog/cortical-layers.ts';
import { createCorticalLayersStore } from '../../lib/state/cortical-layers.svelte.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import type { Region } from '../../lib/types/index.ts';
import './inspector.css';
import LayersSection from './LayersSection.svelte';

const MOTOR = { id: 'julich:left:4', atlas: 'julich', kind: 'cortex' } as Region;
const SENSORY = { id: 'hcp-mmp:left:9', atlas: 'hcp-mmp', kind: 'cortex' } as Region;
const HIPPOCAMPUS = { id: 'hcp-mmp:left:120', atlas: 'hcp-mmp', kind: 'cortex' } as Region;
const PUTAMEN = { id: 'aseg:left:12', atlas: 'aseg', kind: 'structure' } as Region;
const regions = new Map(
  [MOTOR, SENSORY, HIPPOCAMPUS, PUTAMEN].map((region) => [region.id, region]),
);

const published: CorticalLayers = {
  id: 'cortical-layers',
  source: { paper: 'https://doi.org/paper', collection: 'https://doi.org/collection' },
  layers: ['I', 'II', 'III', 'IV', 'V', 'VI'],
  layer_iv_scale: [
    { from: 0, color: [231, 225, 239] },
    { from: 0.07, color: [185, 120, 205] },
  ],
  regions: {
    'julich:left:4': [80, 90, 310, 50, 220, 250],
    'hcp-mmp:left:9': [100, 100, 300, 117, 190, 193],
  },
  cells: {
    datasets: [
      {
        key: 'Motor_4a',
        area: 'Area 4a (PreCG)',
        doi: 'https://doi.org/cells',
        patches: 9,
        mean: [30.5, 79.5, 50.3, 49.9, 45.8, 43.8],
        sd: [9.5, 23.7, 12.3, 24.5, 8.7, 7.9],
      },
    ],
    regions: { 'julich:left:4': 'Motor_4a' },
  },
};

afterEach(() => {
  cleanup();
});

const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();
const details = () => document.querySelector<HTMLDetailsElement>('.evidence-section details');
/** Each table row's cells, read one by one. */
const cells = (within: Element, rows: string) =>
  [...within.querySelectorAll<HTMLTableRowElement>(rows)].map((row) => [...row.cells].map(text));

/** A store whose downloads the test answers, one by one. */
function layersStore() {
  const asked: ((value: ArrayBuffer | Error) => void)[] = [];
  const store = createCorticalLayersStore({
    url: new URL('https://example.test/models/cdmd/cortical-layers.json'),
    regions,
    fetch: () =>
      new Promise((resolve, reject) =>
        asked.push((value) => (value instanceof Error ? reject(value) : resolve(value))),
      ),
  });
  const answer = (value: CorticalLayers | Error) =>
    asked.shift()!(
      value instanceof Error ? value : new TextEncoder().encode(JSON.stringify(value)).buffer,
    );
  return { store, asked, answer };
}

async function shown(region: Region, props: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const layers = layersStore();
  const screen = await render(LayersSection, {
    region,
    lang: 'en',
    layers: layers.store,
    painted: false,
    onpaint: () => calls.push('paint'),
    onrestore: () => calls.push('restore'),
    ...props,
  });
  return { ...layers, calls, screen };
}

test('INSP-58 · a cortical parcel downloads the layers once and shows its six shares, with its area’s cells', async () => {
  const { store, asked, answer, screen } = await shown(PUTAMEN);
  // A structure asks for nothing; the first cortical region asks once.
  expect(asked).toHaveLength(0);
  await screen.rerender({ region: SENSORY });
  await screen.rerender({ region: MOTOR });
  expect(asked).toHaveLength(1);
  answer(published);
  await expect.poll(() => store.state.status).toBe('ready');
  const section = details()!;
  expect(text(section.querySelector('summary')!)).toBe('Layers (one histological brain), IV 5.0%');
  section.open = true;
  // Cell by cell, as a screen reader reads the table: each row headed by its layer.
  expect(cells(section, 'tbody tr')).toEqual([
    ['I', '8.0%', '31 ± 10'],
    ['II', '9.0%', '80 ± 24'],
    ['III', '31.0%', '50 ± 12'],
    ['IV', '5.0%', '50 ± 25'],
    ['V', '22.0%', '46 ± 9'],
    ['VI', '25.0%', '44 ± 8'],
  ]);
  expect(
    [...section.querySelectorAll('tbody th')].map((cell) => cell.getAttribute('scope')),
  ).toEqual(Array(6).fill('row'));
  expect(cells(section, 'thead tr')[0]!.slice(0, 2)).toEqual(['Layer', 'Share of thickness']);
  expect(section.querySelectorAll('thead th')[2]!.textContent).toBe('Cells per (0.1 mm)³');
  expect(text(section)).toContain('the mean over 9 image patches of Area 4a (PreCG)');
  expect([...section.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
    'https://doi.org/paper',
    'https://doi.org/collection',
    'https://doi.org/cells',
  ]);
  await expectAxeClean();
  // Another atlas's parcel has no cells column; one without shares has no section.
  await screen.rerender({ region: SENSORY });
  expect(cells(details()!, 'thead tr')).toEqual([['Layer', 'Share of thickness']]);
  expect(details()!.querySelectorAll('a')).toHaveLength(2);
  await screen.rerender({ region: HIPPOCAMPUS });
  expect(details()).toBeNull();
  expect(asked).toHaveLength(0);
});

test('INSP-60 · Paint asks for layer IV; once painted a ruled strip names it with Restore; another tab offers none', async () => {
  const { store, answer, calls, screen } = await shown(MOTOR);
  answer(published);
  await expect.poll(() => store.data).not.toBeNull();
  details()!.open = true;
  await userEvent.click(page.getByRole('button', { name: 'Paint layer IV across the cortex' }));
  expect(calls).toEqual(['paint']);
  await screen.rerender({ painted: true });
  const status = details()!.querySelector('[role="status"]')!;
  expect(text(status)).toBe(
    'On the brain: layer IV’s share of the cortex’s thickness, from BigBrain. Restore previous view',
  );
  expect(page.getByRole('button', { name: 'Paint layer IV across the cortex' }).query()).toBeNull();
  await userEvent.click(page.getByRole('button', { name: 'Restore previous view' }));
  expect(calls).toEqual(['paint', 'restore']);
  await screen.rerender({ painted: false, onpaint: null });
  expect(page.getByRole('button', { name: 'Paint layer IV across the cortex' }).query()).toBeNull();
});

test('INSP-58 · a failed download says so and Retry asks again', async () => {
  const { store, asked, answer } = await shown(MOTOR);
  answer(new Error('offline'));
  await expect.poll(() => store.state.status).toBe('error');
  details()!.open = true;
  expect(text(details()!)).toContain('The layers could not be downloaded.');
  await userEvent.click(page.getByRole('button', { name: 'Retry' }));
  expect(asked).toHaveLength(1);
  answer(published);
  await expect.poll(() => store.data).not.toBeNull();
  expect(text(details()!.querySelector('summary')!)).toBe(
    'Layers (one histological brain), IV 5.0%',
  );
});
