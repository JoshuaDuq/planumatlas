// The provenance sheet's references for the view: the library is asked for on the first
// opening, the works are listed under what they are behind, and the list leaves as text, BibTeX or RIS.
// The list's content is citations.test.ts's; this is the dialog around it, in Chromium.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../test/fixtures/cdmd-manifest.json';
import type { ReferenceLibrary, ViewCitations, Work } from '../../lib/core/panels/citations.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
// Unstyled, the modal runs past the frame and its last buttons cannot be pressed; styled, it scrolls.
import '../../styles/index.css';
import '../../app/layout.css';
import Fixture from './provenance-test-support.svelte';

const NONE = {
  book: null,
  volume: null,
  issue: null,
  pages: null,
  publisher: null,
  doi: null,
  pmid: null,
  url: null,
  journal: null,
};
const destrieux: Work = {
  ...NONE,
  type: 'article',
  title:
    'Automatic parcellation of human cortical gyri and sulci using standard anatomical nomenclature',
  authors: ['Destrieux C', 'Fischl B', 'Dale A', 'Halgren E'],
  year: 2010,
  journal: 'NeuroImage',
  volume: '53',
  issue: '1',
  pages: '1-15',
  doi: '10.1016/j.neuroimage.2010.06.010',
  pmid: '20547229',
};
const library: ReferenceLibrary = {
  works: { 'pmid:20547229': destrieux },
  planum: {
    ...NONE,
    type: 'software',
    title: 'Planum',
    authors: ['Duquette J'],
    year: null,
    url: 'https://planumatlas.com',
  },
  hcpAcknowledgement: 'Data were provided [in part] by the Human Connectome Project.',
};
const atlas: ViewCitations = {
  cited: [{ behind: 'atlas', citation: 'https://doi.org/10.1016/j.neuroimage.2010.06.010' }],
  hcp: false,
};
const DESTRIEUX_LINE =
  'Destrieux C, Fischl B, Dale A, Halgren E (2010) Automatic parcellation of human cortical gyri and sulci using standard anatomical nomenclature. NeuroImage 53(1):1–15.';

const props = (extra = {}) => ({
  lang: 'en' as const,
  manifest: manifest as unknown as Manifest,
  manifestUrl: '/models/cdmd/manifest.json',
  indexUrl: '/models/anatomies.json',
  domains: null,
  reference: null,
  citations: atlas,
  loadReferences: vi.fn(() => Promise.resolve(library)),
  ...extra,
});

const dialog = () => document.querySelector('dialog') as HTMLDialogElement;
const section = () => dialog().querySelector<HTMLElement>('.provenance-references')!;
const labels = () => [...section().querySelectorAll('dt')].map((dt) => dt.textContent);
const values = () => [...section().querySelectorAll<HTMLElement>('.provenance-value')];
const announced = () => document.getElementById('announcer')!.textContent;

async function open() {
  await userEvent.click(page.getByRole('button', { name: /^Provenance/ }));
  await expect.poll(() => dialog().open).toBe(true);
}

let release: () => void;
beforeEach(async () => {
  await page.viewport(1280, 800);
  const live = document.body.appendChild(document.createElement('div'));
  live.id = 'announcer';
  release = attachAnnouncer(live);
});
afterEach(() => {
  cleanup();
  release();
  document.getElementById('announcer')!.remove();
  vi.restoreAllMocks();
});

test('the first opening asks for the library once and lists Planum, then each work under what it is behind', async () => {
  const shown = props();
  render(Fixture, shown);
  expect(shown.loadReferences).not.toHaveBeenCalled();
  await open();
  await expect.poll(labels).toEqual(['Planum', 'Atlas']);
  expect(values().map((value) => value.textContent!.trim())).toEqual([
    'Duquette J. Planum [software].',
    DESTRIEUX_LINE,
  ]);
  expect([...section().querySelectorAll('a')].map((link) => link.href)).toEqual([
    'https://planumatlas.com/',
    'https://doi.org/10.1016/j.neuroimage.2010.06.010',
  ]);
  await userEvent.keyboard('{Escape}');
  await expect.poll(() => dialog().open).toBe(false);
  await open();
  expect(shown.loadReferences).toHaveBeenCalledTimes(1);
});

test('Copy as text puts the list on the clipboard, a work a line with its link, and says so', async () => {
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  render(Fixture, props());
  await open();
  await userEvent.click(page.getByRole('button', { name: 'Copy as text' }));
  expect(write).toHaveBeenCalledWith(
    `Duquette J. Planum [software]. https://planumatlas.com\n${DESTRIEUX_LINE} https://doi.org/10.1016/j.neuroimage.2010.06.010\n`,
  );
  await expect.poll(announced).toBe('References copied');
});

test('Download .bib and Download .ris save the list as BibTeX and RIS files', async () => {
  const saved: { name: string; href: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ name: this.download, href: this.href });
  });
  render(Fixture, props());
  await open();
  await userEvent.click(page.getByRole('button', { name: 'Download .bib' }));
  expect(announced()).toBe('BibTeX file downloaded.');
  await userEvent.click(page.getByRole('button', { name: 'Download .ris' }));
  expect(announced()).toBe('RIS file downloaded.');
  expect(saved.map(({ name }) => name)).toEqual(['planum-references.bib', 'planum-references.ris']);
  const [bib, ris] = await Promise.all(saved.map(async ({ href }) => (await fetch(href)).text()));
  expect(bib!.startsWith('@misc{planum,\n')).toBe(true);
  expect(bib).toContain('@article{destrieux2010,\n');
  expect(ris!.startsWith('TY  - COMP\r\n')).toBe(true);
  expect(ris).toContain('TY  - JOUR\r\n');
});

test('a library that fails to load says so, and Retry asks again', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const loadReferences = vi
    .fn<() => Promise<ReferenceLibrary>>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(library);
  render(Fixture, props({ loadReferences }));
  await open();
  await expect.element(page.getByText('The references could not be loaded.')).toBeVisible();
  await userEvent.click(page.getByRole('button', { name: 'Retry' }));
  await expect.poll(labels).toEqual(['Planum', 'Atlas']);
  expect(loadReferences).toHaveBeenCalledTimes(2);
});

test('an HCP-derived layer ends the list with the acknowledgement, which stays in English', async () => {
  render(Fixture, props({ lang: 'fr', citations: { ...atlas, hcp: true } }));
  await open();
  await expect.poll(labels).toEqual(['Planum', 'Atlas', 'Remerciements']);
  const acknowledgement = values().at(-1)!;
  expect(acknowledgement.textContent!.trim()).toBe(library.hcpAcknowledgement);
  expect(acknowledgement.getAttribute('lang')).toBe('en');
  expect(values()[1]!.getAttribute('lang')).toBe('en');
});
