// F-TRACT peak delays: each row says its delay, and the rows placed in this brain are plotted by
// centroid distance on one scale for every area, with a table of the same values.
import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import type { FtractParcel, StimulationFtract } from '../../lib/core/catalog/stimulation-ftract.ts';
import { t } from '../../lib/core/i18n/index.ts';
import type { Region } from '../../lib/types/index.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import '../../styles/index.css';
import './inspector.css';
import FtractSection from './FtractSection.svelte';

const copy = t('en', 'stimulation');

const parcel = (name: string, hemisphere: 'left' | 'right', region: string | null) =>
  ({ name, hemisphere, region, area: region ? name : null }) satisfies FtractParcel;

const ftract: StimulationFtract = {
  id: 'stimulation-ftract',
  source: {
    short: 'F-TRACT',
    citation: 'c',
    doi: 'https://doi.org/10.1/x',
    pmid: 1,
    dataset: 'https://doi.org/10.1/y',
  },
  implantations: 20,
  people: 18,
  min_pairs: 10,
  min_implantations: 3,
  min_responses: 10,
  window_ms: 50,
  parcels: [
    parcel('Area A', 'left', 'julich:left:1'),
    parcel('Area B', 'left', 'julich:left:2'),
    parcel('Gap map', 'left', null),
    parcel('Area A', 'right', 'julich:right:1'),
    parcel('Area C', 'left', 'julich:left:3'),
    parcel('Area D', 'left', 'julich:left:4'),
  ],
  pairs: [
    [0, 0, 40, 5, 0.8],
    [0, 1, 30, 6, 0.6],
    [0, 2, 20, 4, 0.5],
    [0, 3, 15, 3, 0.7],
    [0, 4, 25, 4, 0.55],
    [0, 5, 20, 4, 0.3],
    [3, 0, 12, 3, 0.2],
  ],
  delays: [
    [0, 0, 13.086, 4.1, null],
    [0, 1, 26.4, 8.2, 31.4],
    [0, 2, 22, 5, null],
    [0, 3, 35, 6, 92.4],
    [0, 4, 40, 6, 60],
  ],
};

afterEach(() => cleanup());

async function open(lang: 'en' | 'fr' = 'en') {
  await render(FtractSection, { region: { id: 'julich:left:1' } as Region, lang, ftract });
  await userEvent.click(page.getByText(t(lang, 'stimulation').heading));
}

const rows = () => [...document.querySelectorAll('.stimulation-row')].map(text);
const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();
// The distance labels; the delay labels are centred on their lines with `dy`.
const ticks = () => [...document.querySelectorAll('.delay-plot .tick:not([dy])')].map(text);

test('a row with a peak delay says it; the rows placed in this brain are plotted farther right and later higher', async () => {
  await open();
  expect(rows()).toEqual([
    'Within this area 80% 40 pairs · 5 implantations · peak 13 ms',
    'Area B 60% 30 pairs · 6 implantations · peak 26 ms',
    'Area C 55% 25 pairs · 4 implantations · peak 40 ms',
    'Gap map 50% 20 pairs · 4 implantations · peak 22 ms',
    'Area D 30% 20 pairs · 4 implantations',
  ]);
  await expect.element(page.getByRole('img', { name: copy.delayPlot(2) })).toBeInTheDocument();
  // Area B (31 mm, 26 ms), then Area C (60 mm, 40 ms): right of it and above it.
  const [b, c] = [...document.querySelectorAll('.delay-plot .dot')].map((dot) => ({
    x: Number(dot.getAttribute('cx')),
    y: Number(dot.getAttribute('cy')),
  }));
  expect(c!.x).toBeGreaterThan(b!.x);
  expect(c!.y).toBeLessThan(b!.y);
  // The area's own row and the gap map have no distance here.
  expect(text(document.body)).toContain(copy.delayUnplotted(2));
  await userEvent.click(page.getByText(copy.delayTable));
  const cells = [...document.querySelectorAll<HTMLTableRowElement>('.delay-table tbody tr')].map(
    (row) => [...row.cells].map(text),
  );
  expect(cells).toEqual([
    ['Area B', '31', '26', '8'],
    ['Area C', '60', '40', '6'],
    ['Within this area', '—', '13', '4'],
    ['Gap map', '—', '22', '5'],
  ]);
  await expectAxeClean();
});

test('every side and direction is drawn on one scale, to the farthest delay of any area', async () => {
  await open();
  await expect.element(page.getByRole('img', { name: copy.delayPlot(2) })).toBeInTheDocument();
  // The farthest delay is 92.4 mm, across the hemispheres, though this side's is 60 mm.
  const same = ticks();
  expect(same).toEqual(['0', '20', '40', '60', '80', '100']);
  await userEvent.click(page.getByRole('radio', { name: copy.opposite }));
  await expect.element(page.getByRole('img', { name: copy.delayPlot(1) })).toBeInTheDocument();
  expect(ticks()).toEqual(same);
});

test('a side whose rows have no delay says why, with no plot or table', async () => {
  await open();
  await userEvent.click(page.getByRole('radio', { name: copy.to }));
  await userEvent.click(page.getByRole('radio', { name: copy.opposite }));
  await expect.element(page.getByText(copy.noDelays(10))).toBeInTheDocument();
  expect(rows()).toEqual(['Area A 20% 12 pairs · 3 implantations']);
  expect(document.querySelector('.delay-plot')).toBeNull();
  expect(document.querySelector('.delay-table')).toBeNull();
});

test('French', async () => {
  await open('fr');
  expect(rows()[1]).toBe('Aire B 60 % 30 paires · 6 implantations · pic à 26 ms');
});
