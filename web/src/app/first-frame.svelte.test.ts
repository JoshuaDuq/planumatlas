// SHELL-22: what the mount point paints before the app's script has run (layout.css).
import '../styles/index.css';
import './layout.css';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';

let app: HTMLElement;

beforeEach(() => {
  app = document.createElement('div');
  app.id = 'app';
  document.body.append(app);
});
afterEach(async () => {
  app.remove();
  delete document.documentElement.dataset.embed;
  await page.viewport(1280, 800);
});

const fills = () => getComputedStyle(app).backgroundImage.match(/linear-gradient/g)?.length ?? 0;
const pixels = (value: string) => value.split(', ').map((part) => part.trim());

test('SHELL-22 the empty mount point paints the workspace frame at the app’s own sizes', async () => {
  await page.viewport(1280, 800);
  const style = getComputedStyle(app);
  const root = getComputedStyle(document.documentElement);
  const token = (name: string) => {
    const probe = document.createElement('div');
    probe.style.height = `var(${name})`;
    document.body.append(probe);
    const { height } = probe.getBoundingClientRect();
    probe.remove();
    return height;
  };
  const header = token('--header-height');
  const footer = token('--footer-height');
  const tabs = token('--tab-height');
  expect(root.getPropertyValue('--rail-width')).not.toBe('');
  // Rule and ground of the masthead, the status bar and the panel, and the tabs' rule and band.
  expect(fills()).toBe(8);
  expect(style.backgroundColor).toBe('rgb(0, 0, 0)');
  const sizes = pixels(style.backgroundSize);
  expect(sizes[0]).toBe('100% 1px');
  expect(sizes[1]).toBe(`100% ${header}px`);
  expect(sizes[3]).toBe(`100% ${footer}px`);
  expect(sizes[6]!.endsWith(` ${tabs}px`)).toBe(true);
  const positions = pixels(style.backgroundPosition);
  // The masthead's rule is its last pixel row; the tabs' rule is the row under their band.
  expect(positions[0]).toBe(`0px ${header - 1}px`);
  expect(positions[5]).toBe(`0px ${header + tabs}px`);
});

test('SHELL-22 a phone paints the masthead over the stage, and a mounted app paints nothing of it', async () => {
  await page.viewport(390, 844);
  expect(fills()).toBe(2);
  app.append(document.createElement('header'));
  expect(fills()).toBe(0);
});

test('SHELL-22 an embedded frame paints the stage alone at every width', async () => {
  document.documentElement.dataset.embed = '';
  for (const [width, height] of [
    [1280, 800],
    [390, 844],
  ] as const) {
    await page.viewport(width, height);
    expect(fills(), `${width}`).toBe(0);
    expect(getComputedStyle(app).backgroundColor).toBe('rgb(0, 0, 0)');
  }
});
