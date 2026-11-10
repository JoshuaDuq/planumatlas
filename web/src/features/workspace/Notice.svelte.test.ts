// The notice's two kinds and its Retry (U9), in a real browser on the real tokens.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { FOCUS_TARGETS, registerFocusTarget } from '../../lib/ui/focus.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import type { Language, Notice as NoticeState } from '../../lib/types/index.ts';
import Notice from './Notice.svelte';

const button = (name: string) => page.getByRole('button', { name, exact: true });
const ink = () => getComputedStyle(document.querySelector('.notice-text')!).color;
const token = (name: string) => {
  const probe = document.body.appendChild(document.createElement('span'));
  probe.style.color = `var(${name})`;
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
};

let unregister = () => {};
let tab: HTMLButtonElement;
beforeEach(() => {
  tab = document.body.appendChild(document.createElement('button'));
  tab.textContent = 'Anatomy';
  tab.style.cssText = 'color: var(--text-primary); background: var(--surface-base); border: 0';
  unregister = registerFocusTarget(FOCUS_TARGETS.activeTab, () => tab);
});
afterEach(() => {
  cleanup();
  unregister();
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
});

function mount(notice: NoticeState, lang: Language = 'en') {
  const calls: string[] = [];
  const props = $state({
    lang,
    notice: notice as NoticeState | null,
    onAction(action: string) {
      calls.push(action);
      // A retry takes the notice away, as the session's does.
      if (action === 'retry') props.notice = null;
    },
    onDismiss() {
      calls.push('dismiss');
      props.notice = null;
    },
  });
  render(Notice, props);
  return calls;
}

const offline: NoticeState = {
  kind: 'error',
  text: 'Could not load HCP-MMP. A file could not be downloaded. Check the connection and try again.',
  action: 'retry',
  retry: () => {},
};

describe('WORK-27 an error is set apart in danger ink and offers Retry', () => {
  test('an error’s words take the danger ink in both themes, information keeps the primary ink', async () => {
    mount(offline);
    await expect.element(page.getByText(/^Could not load HCP-MMP\./)).toBeVisible();
    for (const theme of ['light', 'dark']) {
      document.documentElement.dataset.theme = theme;
      expect(ink(), theme).toBe(token('--danger'));
      expect(ink(), theme).not.toBe(token('--text-primary'));
    }
    cleanup();
    mount({ kind: 'info', text: 'Both hemispheres shown.' });
    await expect.element(page.getByText('Both hemispheres shown.')).toBeVisible();
    expect(ink()).toBe(token('--text-primary'));
  });

  test('Retry is a keyboard control; it runs the retry and leaves focus on the tab in front', async () => {
    const calls = mount(offline);
    const retry = button('Retry');
    (retry.element() as HTMLElement).focus();
    await expect.element(retry).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(calls).toEqual(['retry']);
    await expect.poll(() => document.querySelector('.notice')).toBeNull();
    expect(document.activeElement).toBe(tab);
  });

  test('in French the action is Réessayer and the dismiss Fermer', async () => {
    mount({ ...offline, text: 'Impossible de charger HCP-MMP.' }, 'fr');
    await expect.element(button('Réessayer')).toBeVisible();
    await expect.element(button('Fermer')).toBeVisible();
  });

  test('axe finds nothing on an error notice, in both themes and at both widths', async () => {
    mount(offline);
    await expect.element(button('Retry')).toBeVisible();
    await expectAxeClean();
  });
});
