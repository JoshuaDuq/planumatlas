// How to use Planum in Chromium: its content in both languages, the title's initial focus, and axe.
// Opening it from the settings menu is the masthead's (Masthead.svelte.test.ts).
import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import '../../app/layout.css';
import GuideDialog from './GuideDialog.svelte';

beforeEach(() => page.viewport(1280, 800));

const dialog = () => document.querySelector('dialog') as HTMLDialogElement;
const headings = () => [...dialog().querySelectorAll('h3')].map((h) => h.textContent);

test('a titled dialog of four ruled parts, its title focused, in English and French', async () => {
  const view = await render(GuideDialog, { open: true, lang: 'en', fallbackFocus: () => null });
  await expect.element(page.getByRole('dialog', { name: 'How to use Planum' })).toBeVisible();
  expect(document.activeElement).toBe(dialog().querySelector('h2'));
  expect(headings()).toEqual(['The brain', 'The top bar', 'The panel', 'The medial surface']);
  expect(dialog().textContent).toContain('Not clinical anatomy.');

  await view.rerender({ lang: 'fr' });
  await expect.element(page.getByRole('dialog', { name: 'Utiliser Planum' })).toBeVisible();
  expect(headings()).toEqual(['Le cerveau', 'La barre du haut', 'Le panneau', 'La face médiale']);
});

test('axe: light and dark, desktop and 390 px', async () => {
  await render(GuideDialog, { open: true, lang: 'en', fallbackFocus: () => null });
  await expect.poll(() => dialog().open).toBe(true);
  await expectAxeClean();
});
