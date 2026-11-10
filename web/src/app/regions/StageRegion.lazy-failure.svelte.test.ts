// The stage region's lazily fetched code failing to load: the snapshot and the Linked MRI dialog.
import '../../styles/index.css';
import '../layout.css';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import manifestFile from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import domainsFile from '../../../../public/models/cdmd/neuropsych-domains.json' with { type: 'json' };
import { validateNeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import { createApp, APP } from '../application.svelte.ts';
import type { App } from '../application.svelte.ts';
import { composeWorld } from '../world.ts';
import StageRegion from './StageRegion.svelte';

// A module whose evaluation throws, as a chunk a newer deploy removed fails its import.
vi.mock('../../features/snapshot/snapshot.ts', () => ({
  get saveSnapshot(): never {
    throw new Error('The snapshot chunk did not load.');
  },
}));
vi.mock('../../features/sections/MprDialog.svelte', () => ({
  get default(): never {
    throw new Error('The Linked MRI chunk did not load.');
  },
}));

const manifest = manifestFile as unknown as Manifest;
const domains = validateNeuropsychDomains(
  domainsFile as unknown as NeuropsychDomains,
  new Map(manifest.regions.map((region) => [region.id, region])),
);

let engine: FakeEngine;
let app: App;
let target: HTMLElement;
let region: { saveImage(): Promise<void> } | null;
let detach: () => void;

beforeEach(async () => {
  // Another file in the same browser may have left a remembered language or tour state.
  localStorage.clear();
  await page.viewport(1280, 800);
  engine = createFakeEngine({ manifest, domains: domains as never });
  target = document.body.appendChild(document.createElement('div'));
  target.id = 'app';
  detach = attachAnnouncer(document.body.appendChild(document.createElement('p')));
  // The failures are logged as well as said.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  app = createApp();
  app.attach(await composeWorld(app, engine, 'cdmd'));
  app.session.setLoaded();
  region = mount(StageRegion, { target, context: new Map([[APP, app]]) }) as never;
  flushSync();
});
afterEach(() => {
  app.dispose();
  if (region) unmount(region as never);
  region = null;
  detach();
  target.remove();
  vi.restoreAllMocks();
});

const notice = () => app.session.state.notice?.text;

test('a snapshot whose code does not load is a failed save, and nothing is left saving', async () => {
  await region!.saveImage();
  expect(notice()).toBe('Could not save the image.');
  app.session.notify(null);
  // The next save asks again and settles the same way, rather than joining a save that never ends.
  await region!.saveImage();
  expect(notice()).toBe('Could not save the image.');
});

test('a Linked MRI whose code does not load closes and says so, and M opens it again', async () => {
  await engine.sections.load();
  app.ports.showMri({ instant: true });
  await vi.waitFor(() => expect(notice()).toBe('Could not open the linked MRI.'));
  expect(app.ports.mprOpen()).toBe(false);
  expect(target.querySelector('.mpr-dock')).toBeNull();
  // Closed, so M opens it and asks for its code again, rather than closing a dialog nobody sees.
  app.session.notify(null);
  app.ports.openMpr({ instant: true });
  await vi.waitFor(() => expect(notice()).toBe('Could not open the linked MRI.'));
  expect(app.ports.mprOpen()).toBe(false);
});
