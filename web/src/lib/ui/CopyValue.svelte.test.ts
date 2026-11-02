// CopyValue: the value is its own copy button, says what became of the copy in place and aloud,
// and never moves the words around it.
import '../../styles/index.css';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cdp, page } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { withMedia } from './a11y-test-support.ts';
import { COPIED_MS, FAILED_MS } from './clipboard.svelte.ts';
import { aroundValue } from './CopyValue.svelte';
import Fixture from './copy-value-test-support.svelte';

const VALUE = '−41.0, +26.2, +28.3 mm';
const button = () => page.getByRole('button', { name: `${VALUE}, Copy`, exact: true });
const el = () => button().element() as HTMLElement;
const said = () => el().querySelector('.copy-said')?.textContent ?? null;
const announced = () => document.getElementById('announcer')!.textContent;
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
// A frame comes after every pending microtask, so the clipboard's answer has landed; the faked
// timeouts stay where they are (expect.poll would advance them).
async function answered() {
  await frame();
  flushSync();
}
const afterBox = () => document.querySelector('.after')!.getBoundingClientRect().toJSON();

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('CopyValue', () => {
  test('a press copies the value as shown and says Copied in place, then rests', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(Fixture, { value: VALUE });
    await expect.element(button()).toBeVisible();
    expect(el().dataset.tooltip).toBe('Copy');
    await document.fonts.ready;
    const before = afterBox();

    el().click();
    await answered();
    expect(said()).toBe('Copied');
    expect(write).toHaveBeenCalledExactlyOnceWith(VALUE);
    expect(announced()).toBe('Copied');
    expect(el().dataset.tooltip).toBeUndefined();
    // The confirmation floats: the sentence after the value has not moved.
    expect(afterBox()).toEqual(before);

    vi.advanceTimersByTime(COPIED_MS - 1);
    flushSync();
    expect(said()).toBe('Copied');
    vi.advanceTimersByTime(1);
    flushSync();
    expect(said()).toBeNull();
  });

  test('a refused write is shown, said and logged, and stands longer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const refusal = new DOMException('Write permission denied.', 'NotAllowedError');
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(refusal);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(Fixture, { value: VALUE });

    el().click();
    await answered();
    expect(said()).toBe('Could not copy');
    expect(announced()).toBe('Could not copy');
    expect(logged).toHaveBeenCalledExactlyOnceWith(refusal);

    vi.advanceTimersByTime(FAILED_MS - 1);
    flushSync();
    expect(said()).toBe('Could not copy');
    vi.advanceTimersByTime(1);
    flushSync();
    expect(said()).toBeNull();
  });

  test('quiet at rest for a mouse; a touch reader is shown the copy icon', async () => {
    render(Fixture, { value: VALUE });
    const icon = () => el().querySelector<HTMLElement>('.copy-icon')!;
    await expect.element(button()).toBeVisible();
    expect(icon().checkVisibility()).toBe(false);
    // Chromium reports a coarse pointer only while touch is emulated too.
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    try {
      await withMedia([{ name: 'pointer', value: 'coarse' }], async () => {
        await frame();
        expect(icon().checkVisibility()).toBe(true);
      });
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('a sentence splits around its value, and one without it is refused', () => {
    expect(aroundValue((point) => `Lands at ${point} here`)).toEqual(['Lands at ', ' here']);
    expect(() => aroundValue(() => 'No value')).toThrow();
  });
});
