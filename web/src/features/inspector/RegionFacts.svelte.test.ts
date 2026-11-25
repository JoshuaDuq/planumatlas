// A cortical region's mean thickness among its measurements, downloaded when they first open.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { createRegionThicknessStore } from '../../lib/state/cortical-thickness.svelte.ts';
import type { Region } from '../../lib/types/index.ts';
import './inspector.css';
import RegionFacts from './RegionFacts.svelte';

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

const precentral = {
  id: 'desikan:left:24',
  atlas: 'desikan',
  kind: 'cortex',
  hemisphere: 'left',
  surface_area_mm2: 4185,
  source_label_id: 24,
  source_name: 'precentral',
} as unknown as Region & { atlas: string };
const regions = new Map<string, Region>([[precentral.id, precentral]]);
const published = { regions: { [precentral.id]: [2.535, 0.512] } };

function store(answer: () => Promise<ArrayBuffer>) {
  const fetch = vi.fn((url: URL) => {
    void url;
    return answer();
  });
  return {
    fetch,
    thickness: createRegionThicknessStore({
      url: new URL('https://example.test/t.json'),
      regions,
      fetch,
    }),
  };
}
/** Opened as the reader opens it: the section's own disclosure. */
async function open() {
  const section = document.querySelector<HTMLDetailsElement>('.measurements details')!;
  section.open = !section.open;
  await new Promise((resolve) => section.addEventListener('toggle', resolve, { once: true }));
}
const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).buffer;
const row = () =>
  [...document.querySelectorAll('.measurements dt')]
    .find((term) => term.textContent === 'Mean thickness')
    ?.nextElementSibling?.textContent?.trim();

describe('THICK-05 the measurements of a cortical region', () => {
  test('download its thickness once they first open, and give it as mean ± standard deviation', async () => {
    const { fetch, thickness } = store(async () => json(published));
    await render(RegionFacts, { region: precentral, lang: 'en', centroid: null, thickness });
    expect(fetch).not.toHaveBeenCalled();
    await open();
    await expect.poll(row).toBe('2.54 ± 0.51 mm');
    await open();
    await open();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('say nothing of thickness where none is published, and a dash where it failed to download', async () => {
    await render(RegionFacts, { region: precentral, lang: 'en', centroid: null, thickness: null });
    await open();
    expect(row()).toBeUndefined();
    cleanup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { thickness } = store(async () => {
      throw new Error('offline');
    });
    await render(RegionFacts, { region: precentral, lang: 'en', centroid: null, thickness });
    await open();
    await expect.poll(row).toBe('—');
  });
});
