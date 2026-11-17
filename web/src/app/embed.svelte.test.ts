// A link with embed=1, as a course page frames it: the stage and its one line, nothing of the anatomy
// fetched until the reader asks, and Open in Planum carrying the view out of the frame.
import '../styles/index.css';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { ASSET_BASE } from '../../build/site.ts';
import manifestFile from '../../test/fixtures/cdmd-manifest.json' with { type: 'json' };
import domainsFile from '../../../public/models/cdmd/neuropsych-domains.json' with { type: 'json' };
import { validateNeuropsychDomains } from '../lib/core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../lib/core/catalog/neuropsych-domains.ts';
import type { CreateEngine } from '../lib/engine/api.ts';
import { createFakeEngine } from '../lib/engine/fake.ts';
import type { Manifest } from '../lib/types/index.ts';
import { expectAxeClean } from '../lib/ui/a11y-test-support.ts';
import { attachAnnouncer } from '../lib/ui/announcer.svelte.ts';
import App from './App.svelte';
import { APP, createApp } from './application.svelte.ts';
import type { App as AppStore } from './application.svelte.ts';
import { startApp } from './boot.ts';

// The index of published brains, as the site serves it.
vi.mock('../lib/core/assets/published-anatomy.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/core/assets/published-anatomy.ts')>()),
  loadAnatomies: async () => ({
    default: 'cdmd',
    anatomies: [{ id: 'cdmd', display_name: 'MGH CDMD “sub_013”' }],
  }),
}));

const VIEW = 'atlas=hcp-mmp&view=left&lang=en';

const manifest = manifestFile as unknown as Manifest;
const domains = validateNeuropsychDomains(
  domainsFile as unknown as NeuropsychDomains,
  new Map(manifest.regions.map((region) => [region.id, region])),
);

let target: HTMLElement;
let shell: Record<string, unknown> | null;
let store: AppStore;
let announcer: HTMLElement;
let detach: () => void;

/** The page as main.ts mounts it, opened on `hash`. */
function open(hash: string) {
  history.replaceState(null, '', `${location.pathname}#${hash}`);
  store = createApp();
  shell = mount(App, { target, context: new Map([[APP, store]]) });
  flushSync();
}

const openLink = (name = /^Open in Planum/) =>
  page.getByRole('link', { name }).element() as HTMLAnchorElement;

beforeEach(async () => {
  await page.viewport(1280, 800);
  announcer = document.body.appendChild(document.createElement('p'));
  detach = attachAnnouncer(announcer);
  target = document.body.appendChild(document.createElement('div'));
  target.id = 'app';
  shell = null;
});
afterEach(() => {
  if (shell) unmount(shell);
  store.dispose();
  detach();
  announcer.remove();
  target.remove();
  history.replaceState(null, '', location.pathname);
  vi.restoreAllMocks();
});

describe('an embedded link', () => {
  test('BOOT-35 fetches no model before the reader asks for the brain, then opens the link’s', async () => {
    history.replaceState(null, '', `${location.pathname}#${VIEW}&embed=1`);
    store = createApp();
    // Not mounted: the start alone. A host for the engine it may open.
    const host = document.body.appendChild(
      Object.assign(document.createElement('main'), { id: 'viewport' }),
    );
    const fetching = vi.spyOn(globalThis, 'fetch');
    const createEngine = vi.fn<CreateEngine>(async () => {
      throw new Error('No engine in this test.');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const started = startApp(store, createEngine);
      // The index names the subject for the frame's line, and the start waits there.
      await vi.waitFor(() => expect(store.embed?.subject?.id).toBe('cdmd'));
      expect(createEngine).not.toHaveBeenCalled();
      expect(fetching.mock.calls.filter(([url]) => String(url).includes('models/'))).toEqual([]);
      expect(store.session.state.status).toBe('loading');

      store.embed!.invite();
      await started;
      expect(createEngine).toHaveBeenCalledOnce();
      expect(createEngine.mock.calls[0]![0]).toMatchObject({
        manifestUrl: `${ASSET_BASE}models/cdmd/manifest.json`,
        atlas: 'hcp-mmp',
      });
    } finally {
      host.remove();
    }
  });

  test('BOOT-35 a page of its own starts at once', async () => {
    history.replaceState(null, '', `${location.pathname}#${VIEW}`);
    store = createApp();
    expect(store.embed).toBeNull();
    const host = document.body.appendChild(
      Object.assign(document.createElement('main'), { id: 'viewport' }),
    );
    const createEngine = vi.fn<CreateEngine>(async () => {
      throw new Error('No engine in this test.');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await startApp(store, createEngine);
      expect(createEngine).toHaveBeenCalledOnce();
    } finally {
      host.remove();
    }
  });

  test('SHELL-19 mounts the stage and one line: no masthead, panel or status bar, at any width', async () => {
    open(`${VIEW}&embed=1`);
    expect(target.hasAttribute('data-embed')).toBe(true);
    expect(target.querySelector('header, aside, #colophon')).toBeNull();
    const main = target.querySelector('main')!;
    const line = target.querySelector('footer')!;
    expect(page.getByRole('contentinfo').element()).toBe(line);
    store.embed!.subject = { id: 'cdmd', display_name: 'MGH CDMD “sub_013”' };
    flushSync();
    expect(line.textContent!.replace(/\s+/g, ' ')).toMatch(
      /^MGH CDMD sub_013 ?Not clinical anatomy ?Open in Planum/,
    );
    for (const [width, height] of [
      [1280, 800],
      [390, 844],
    ] as const) {
      await page.viewport(width, height);
      const frame = target.getBoundingClientRect();
      const stage = main.getBoundingClientRect();
      expect(stage.width, `${width}`).toBe(frame.width);
      expect(stage.top, `${width}`).toBe(frame.top);
      expect(line.getBoundingClientRect().top, `${width}`).toBeGreaterThanOrEqual(
        stage.bottom - 0.5,
      );
    }
    // The panels' ports answer, so a pick or a link in a frame changes nothing rather than throwing.
    expect(() => store.ports.showDetail()).not.toThrow();
    expect(store.ports.readingPlace()).toBeNull();
    await expect(store.ports.showTracts(['af-left'])).resolves.toBeUndefined();
  });

  test('SHELL-19 a still and one control until the reader asks; then the download, focus on the stage', async () => {
    open(`${VIEW}&embed=1`);
    const poster = target.querySelector<HTMLImageElement>('.embed-poster img')!;
    expect(new URL(poster.src).pathname).toBe(`${ASSET_BASE}preview.png`);
    expect(poster.alt).not.toBe('');
    expect(target.querySelector('#stage-message')).toBeNull();
    await userEvent.tab();
    const load = page.getByRole('button', { name: /^Load the 3D brain \(about 20\sMB\)$/ });
    expect(document.activeElement).toBe(load.element());
    await expectAxeClean();
    await userEvent.click(load);
    expect(store.embed!.invited).toBe(true);
    expect(document.activeElement).toBe(target.querySelector('main'));
    // The stage says the download, and the page's announcer says it began.
    await expect.element(page.elementLocator(target).getByText('Loading anatomy…')).toBeVisible();
    expect(announcer.textContent).toBe('Loading anatomy…');
    expect(target.querySelector('.embed-poster')).toBeNull();
  });

  test('SHELL-19 in French', async () => {
    open('atlas=hcp-mmp&lang=fr&embed=1');
    await expect
      .element(page.getByRole('button', { name: /^Charger le cerveau en 3D \(environ 20\sMo\)$/ }))
      .toBeVisible();
    await expect.element(page.getByText('Pas une anatomie clinique')).toBeVisible();
    // Named with the French words that say it opens a new tab.
    expect(openLink(/^Ouvrir dans Planum \(s’ouvre dans un nouvel onglet\)$/).target).toBe(
      '_blank',
    );
  });

  test('SHELL-20 the arriving view stays in the address and in Open in Planum while its link is applied', async () => {
    const view = 'atlas=destrieux&region=destrieux:left:30&cut=coronal&lang=en';
    open(`${view}&embed=1`);
    const engine = createFakeEngine({ manifest, domains: domains as never });
    // Read where the start has put the stage over the engine and not yet begun applying the link.
    let during: { hash: string; href: string } | null = null;
    const setFramingSource = engine.camera.setFramingSource;
    engine.camera.setFramingSource = (source) => {
      during = { hash: location.hash, href: openLink().href };
      setFramingSource(source);
    };
    const started = startApp(store, async () => engine);
    store.embed!.invite();
    await started;
    expect(store.session.state.status).toBe('ready');
    expect(during).toEqual({
      hash: `#${view}&embed=1`,
      href: `${location.origin}${location.pathname}#${view}`,
    });
    // The link applied, the scene it names is on the stage.
    expect(store.world!.view.current.selectedRegion?.id).toBe('destrieux:left:30');
    expect(engine.sections.state.mode).toBe('coronal');
  });

  test('SHELL-20 Open in Planum opens the view on screen without embed, in a tab of its own', async () => {
    open(`${VIEW}&embed=1`);
    const link = openLink();
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noreferrer');
    const pageUrl = new URL(location.href);
    const url = new URL(link.href);
    expect(url.origin + url.pathname).toBe(pageUrl.origin + pageUrl.pathname);
    expect(url.hash).toBe(`#${VIEW}`);
    // The view moves on as the reader turns or cuts it; the link follows before it can be followed.
    history.replaceState(null, '', `${location.pathname}#atlas=julich&cut=coronal&lang=en&embed=1`);
    link.focus();
    expect(new URL(link.href).hash).toBe('#atlas=julich&cut=coronal&lang=en');
    history.replaceState(null, '', `${location.pathname}#atlas=schaefer&lang=en&embed=1`);
    link.dispatchEvent(new PointerEvent('pointerenter'));
    expect(new URL(link.href).hash).toBe('#atlas=schaefer&lang=en');
  });
});
