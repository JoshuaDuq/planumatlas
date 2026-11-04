import { afterEach, describe, expect, test } from 'vitest';
import { cdp, page } from 'vitest/browser';
import './index.css';
import '../app/layout.css';

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name);

describe('phone tokens (viewer/styles/phone.css:15)', () => {
  afterEach(() => page.viewport(1280, 800));

  test('touch sizes at 390 px wide', async () => {
    await page.viewport(390, 844);
    expect(token('--control-height')).toBe('44px');
    expect(token('--row-height')).toBe('44px');
    expect(token('--tab-height')).toBe('44px');
    expect(token('--header-height')).toBe('max(52px, 3.25rem)');
    expect(token('--panel-inset')).toBe('16px');
  });

  test('a landscape phone gets all five, though the tablet rule matches its width too', async () => {
    for (const [width, height] of [
      [812, 375],
      [844, 390],
    ]) {
      await page.viewport(width, height);
      const at = `${width}x${height}`;
      expect(token('--control-height'), at).toBe('44px');
      expect(token('--row-height'), at).toBe('44px');
      expect(token('--tab-height'), at).toBe('44px');
      expect(token('--header-height'), at).toBe('max(52px, 3.25rem)');
      expect(token('--panel-inset'), at).toBe('16px');
    }
  });

  test('a coarse pointer on a desktop-sized viewport gets 44px rows, controls and tabs (phone.css:318)', async () => {
    await page.viewport(1280, 800);
    expect(resolved('height', '--row-height')).toBe('32px');
    // Touch emulation is what makes Chromium report a coarse primary pointer.
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      expect(token('--row-height')).toBe('44px');
      expect(token('--control-height')).toBe('44px');
      expect(token('--tab-height')).toBe('44px');
      expect(token('--header-height')).toBe('max(48px, 3rem)');
    } finally {
      await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('desktop keeps instrument density at 16px text, and rows, controls and the rail grow with reader text', async () => {
    await page.viewport(1280, 800);
    const sizes = (rootPx: string) => {
      document.documentElement.style.fontSize = rootPx;
      return ['--control-height', '--row-height'].map((name) => resolved('height', name));
    };
    try {
      expect(sizes('16px')).toEqual(['32px', '32px']);
      expect(resolved('width', '--rail-width')).toBe('360px');
      expect(sizes('20px')).toEqual(['40px', '40px']);
      expect(resolved('width', '--rail-width')).toBe('450px');
      // Never more than half the window.
      expect(sizes('32px')).toEqual(['64px', '64px']);
      expect(resolved('width', '--rail-width')).toBe('640px');
      // 801–1000px: 320px at 16px text, at most 40% of the window.
      await page.viewport(900, 800);
      sizes('16px');
      expect(resolved('width', '--rail-width')).toBe('320px');
      sizes('20px');
      expect(resolved('width', '--rail-width')).toBe('360px');
    } finally {
      document.documentElement.style.fontSize = '';
    }
  });
});

/** The pixel length a token gives a probe's `property`. */
function resolved(property: 'height' | 'width', name: string): string {
  const probe = document.createElement('div');
  probe.style[property] = `var(${name})`;
  document.body.append(probe);
  const value = getComputedStyle(probe)[property];
  probe.remove();
  return value;
}
