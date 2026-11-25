/** Render every figure of the README and the methods site from the viewer.
 *
 *   node scripts/figures.mjs [origin] [figure ...]   render all figures, or only those named
 *   node scripts/figures.mjs --links                 check each legend's live-view links against the captured states
 *
 * origin defaults to http://127.0.0.1:5173/, the dev server of this working tree (npm run dev --prefix web);
 * pass https://planumatlas.com/ to render from the live site. Needs the Playwright Chromium installed for web/
 * (npx playwright install chromium) and, for the plots and the synthetic overlay map, uv.
 *
 * Each panel is a native capture of the viewer: the stage, a Linked MRI plane, a panel of the interface or a
 * saved image. Captures are cropped and composed, never recoloured. The script draws only what a figure
 * needs around them: panel letters, scale bars from the viewer's own, and colour keys read from the stage's.
 * Plots come from scripts/figure_plots.py, drawn from the published files. Figures are 2,400 px wide for
 * Nature's 183 mm, so 1 pt is 4.6 px: letters are 8 pt bold, other text 7 pt, in Source Sans 3.
 * README figures go to .github/assets/readme/, the methods pages' to docs/features/figures/, each as
 * -light.webp and -dark.webp on a transparent ground.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIGURES, MAPS } from './figure-definitions.mjs';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const checkLinks = args[0] === '--links';
if (checkLinks) args.shift();
const origin = args[0]?.startsWith('http') ? args.shift() : 'http://127.0.0.1:5173/';
const LIVE = 'https://planumatlas.com/';
const OUTPUT = { readme: '.github/assets/readme/', docs: 'docs/features/figures/' };

// How much two frames of a view at rest may differ: by this many levels of 255, or in this many pixels.
const FLICKER = 2;
const SPECKS = 8;
const WIDTH = 2400;
const MAX_HEIGHT = Math.floor(WIDTH * 170 / 183);
const GUTTER = 28;
const STYLE = {
  band: 50, letter: 37, text: 32, rule: 4, inset: 24, quality: 0.86,
  // Figure pixels per CSS pixel of a captured interface panel: its 15 px text is then 6 pt.
  panel: 1.9,
  inks: { light: '#000000', dark: '#e6edf3' },
};
// Plots are drawn at the figure's own resolution, so their points are the figure's points.
const DPI = WIDTH / (183 / 25.4);
const PLOT_TOOLS = ['matplotlib==3.11.2', 'fonttools==4.68.0', 'brotli==1.2.1', 'numpy==2.4.6', 'nibabel==5.4.2', 'scipy==1.18.1'];
// The GPU backend of each platform; set PLANUM_ANGLE to use another.
const ANGLE = process.env.PLANUM_ANGLE ?? { darwin: 'metal', win32: 'd3d11' }[process.platform] ?? 'gl';

export const hashOf = (state) => new URLSearchParams(state).toString().replaceAll('%2C', ',').replaceAll('%3A', ':');

/** Where each panel sits: [column, row, columns spanned, rows spanned], or row by row. */
function slotsOf({ columns = 3, aspect, grid, panels }) {
  const cell = (WIDTH - GUTTER * (columns - 1)) / columns;
  const height = Math.round(cell / aspect);
  return panels.map((_, index) => {
    const [column, row, across, down] = grid?.[index] ?? [index % columns, Math.floor(index / columns), 1, 1];
    return { column, row, down, x: Math.round(column * (cell + GUTTER)), w: Math.round(across * cell + (across - 1) * GUTTER), cell: height };
  });
}

/** Run before the viewer's own scripts, on every load. */
function prepare({ theme, css }) {
  localStorage.clear();
  localStorage.setItem('planum.guide', 'seen');
  localStorage.setItem('planum.stage-hint', 'retired');
  localStorage.setItem('planum.theme', theme);
  // The viewer draws fewer pixels on an integrated GPU. A figure is drawn as a desktop with a discrete card
  // draws it, at two device pixels per CSS pixel, whatever machine renders it, so the GPU is named as one.
  for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const read = prototype.getParameter;
    prototype.getParameter = function getParameter(name) {
      return name === 0x9246 ? 'NVIDIA (figure rendering)' : read.call(this, name);
    };
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
  });
}

/** How two screenshots differ: the largest difference in levels of 255, and how many pixels differ at all. */
const difference = (page, a, b) => page.evaluate(async (sources) => {
  const pixels = await Promise.all(sources.map(async (source) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${source}`)).blob());
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
  }));
  if (pixels[0].length !== pixels[1].length) return { most: 256, pixels: Infinity };
  let most = 0;
  const changed = new Set();
  for (let i = 0; i < pixels[0].length; i++) {
    const apart = Math.abs(pixels[0][i] - pixels[1][i]);
    if (apart) changed.add(i >> 2);
    most = Math.max(most, apart);
  }
  return { most, pixels: changed.size };
}, [a.toString('base64'), b.toString('base64')]);

/**
 * Screenshots of `target`, half a second apart, until three in a row are the same picture: the view is at rest.
 * A canvas the viewer dithers can differ by a level from one frame to the next for ever, and the edge of a
 * control by a few pixels. Pictures within FLICKER levels of each other, or that differ in at most SPECKS
 * pixels, count as the same, and the panel is reported.
 */
async function atRest(target, page, pad) {
  const start = Date.now();
  let last;
  let flicker = null;
  for (let same = 0; same < 2;) {
    if (Date.now() - start > 120_000) throw new Error('The view did not come to rest within two minutes.');
    // With `pad`, the picture takes that many CSS pixels around the element, for text that overhangs its box.
    const box = pad && await target.boundingBox();
    const shot = box
      ? await page.screenshot({ animations: 'disabled', clip: { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad } })
      : await target.screenshot({ animations: 'disabled', timeout: 120_000 });
    const apart = !last || last.equals(shot) ? null : await difference(page, last, shot);
    const steady = !apart || apart.most <= FLICKER || apart.pixels <= SPECKS;
    same = last && steady ? same + 1 : 0;
    if (apart && steady) flicker = apart;
    last = shot;
    // A sampling interval, not a wait for readiness: taking a screenshot can itself make the viewer redraw.
    if (same < 2) await page.waitForTimeout(500);
  }
  if (flicker) console.log(`  at rest, this panel still differs between frames in ${flicker.pixels} pixels, by up to ${flicker.most} of 255 levels`);
  return last;
}

/** One interaction a reader would make, as [action, ...arguments]. */
async function act(page, [action, a, b], files) {
  const find = (selector) => page.locator(selector).first();
  if (action === 'click') await page.getByRole(a, { name: b, exact: true }).first().click();
  else if (action === 'text') await page.getByText(a, { exact: true }).first().click();
  else if (action === 'match') await page.getByText(new RegExp(a)).first().click();
  else if (action === 'css') await find(a).click();
  else if (action === 'press') await page.keyboard.press(a);
  else if (action === 'fill') await find(a).fill(b);
  else if (action === 'blur') await find(a).blur();
  else if (action === 'select') await find(a).selectOption(b);
  else if (action === 'file') await find(a).setInputFiles(files[b]);
  else if (action === 'shown') await find(a).waitFor({ state: 'visible' });
  else if (action === 'attached') await find(a).waitFor({ state: 'attached' });
  else if (action === 'style') await page.addStyleTag({ content: a });
  else if (action === 'into') await find(a).scrollIntoViewIfNeeded();
  else throw new Error(`Unknown step: ${action}`);
}

/** The stage's colour keys as data: each open plate's rows, a colour or a ramp and its label. */
const readKeys = (page) => page.evaluate(() => [...document.querySelectorAll('#stage-keys .stage-key-body:not([hidden]) li')]
  .filter((row) => !row.dataset.absent)
  .map((row) => ({
    colour: row.querySelector('.network-swatch')?.style.background ?? '',
    label: row.querySelector('.stage-key-label')?.textContent.trim() ?? '',
  })));

/** Millimetres per CSS pixel at the camera target's depth, from the stage's own scale bar. */
async function readScale(page) {
  const { rule, label } = await page.evaluate(() => ({
    rule: parseFloat(document.querySelector('#scale-bar .scale-bar-rule')?.style.width),
    label: document.querySelector('#scale-bar .measure')?.textContent ?? '',
  }));
  const millimetres = parseFloat(label.replace(',', '.'));
  if (!(rule > 0) || !(millimetres > 0)) throw new Error(`The stage shows no scale bar (${rule}, "${label}").`);
  return millimetres / rule;
}

/** What a panel pictures: the stage, a Linked MRI plane, a saved image, or the element a selector names. */
const kindOf = (panel) => panel.shot ?? (panel.mri ? 'mri' : 'stage');
const scaleOf = (panel) => panel.scale ?? (kindOf(panel) === 'mri' ? 3 : 2);

async function capture(contexts, panel, theme, files) {
  const kind = kindOf(panel);
  const scale = scaleOf(panel);
  // A panel of the interface is captured in a window tall enough to show it without scrolling.
  const [width, height] = panel.viewport ?? { stage: [1400, 1000], mri: [1600, 1000], download: [1400, 1000] }[kind] ?? [1400, 2400];
  const page = await (await contexts(scale, theme)).newPage();
  await page.setViewportSize({ width, height });
  page.setDefaultTimeout(120_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`${origin}#${hashOf(panel.state)}`);
    await page.waitForFunction(() => document.querySelector('#app')?.dataset.status === 'ready', undefined, { timeout: 240_000 });
    await page.waitForLoadState('networkidle', { timeout: 240_000 });
    const shown = new URLSearchParams(new URL(page.url()).hash.slice(1));
    const sorted = (value) => value?.split(',').sort().join(',');
    for (const [key, value] of Object.entries(panel.state)) {
      if (sorted(shown.get(key)) !== sorted(value)) throw new Error(`The viewer did not keep ${key}=${value}: ${page.url()}`);
    }
    await page.evaluate(() => document.fonts.ready);
    for (const step of panel.steps ?? []) await act(page, step, files);
    let target = page.locator('#viewport');
    if (kind === 'mri') {
      if (!panel.steps) await page.getByRole('button', { name: 'Linked MRI', exact: true }).first().click();
      target = page.locator(`.mpr-dock section.plane[data-plane="${panel.mri}"] canvas`);
      await target.waitFor({ state: 'visible' });
    } else if (kind !== 'stage' && kind !== 'download') {
      target = page.locator(kind).first();
      await target.waitFor({ state: 'visible' });
    }
    const result = {};
    // The dock holds the tools the steps used, so it is hidden only now.
    if (kind === 'stage' || kind === 'mri') await page.addStyleTag({ content: '.stage-dock,.mpr-dock .picture>:not(canvas){visibility:hidden!important}' });
    await page.mouse.move(0, height - 1);
    if (kind === 'download') {
      const [download] = await Promise.all([page.waitForEvent('download'), act(page, panel.download, files)]);
      if (panel.file && download.suggestedFilename() !== panel.file) throw new Error(`The viewer named the image ${download.suggestedFilename()}, not ${panel.file}.`);
      result.png = await readFile(await download.path());
    } else {
      await page.waitForLoadState('networkidle');
      result.png = await atRest(target, page, panel.pad);
    }
    // The key and the scale are read once the picture is at rest: a step may change the paint or move the
    // camera, and both follow it.
    result.keys = panel.keys ? await readKeys(page) : [];
    if (panel.keys && !result.keys.length) throw new Error('The stage shows no colour key.');
    if (kind === 'stage') result.mm = await readScale(page) / scale;
    if (kind === 'mri') {
      // The plane's own pixels, as the viewer drew them, once the picture on the page has come to rest.
      result.png = Buffer.from((await target.evaluate((canvas) => canvas.toDataURL('image/png'))).split(',')[1], 'base64');
      // A Linked MRI plane spans the scan's field of view, 256 mm on both anatomies (volumes.json).
      result.mm = 256 / result.png.readUInt32BE(16);
    }
    if (errors.length) throw new Error(errors.join('\n'));
    return result;
  } catch (error) {
    throw new Error(`${hashOf(panel.state)}: ${error.message}`, { cause: error });
  } finally {
    await page.close();
  }
}

/** Runs in the page: crop each capture, tile the panels, draw letters, scale bars and keys, encode WebP. */
async function compose({ figure, slots, panels, width, gutter, maxHeight, style, font }) {
  const face = new FontFace('Figure Sans', Uint8Array.from(atob(font), (c) => c.charCodeAt(0)), { weight: '200 900' });
  document.fonts.add(await face.load());
  const load = (src) => new Promise((done, fail) => {
    const image = new Image();
    image.onload = () => done(image);
    image.onerror = () => fail(new Error('A panel image did not decode.'));
    image.src = src;
  });
  const pictures = await Promise.all(panels.map(async ({ images }) => ({
    light: await load(images.light), dark: await load(images.dark ?? images.light),
  })));
  const band = panels.length > 1 ? style.band : 0;
  const text = `${style.text}px "Figure Sans"`;
  const measure = new OffscreenCanvas(8, 8).getContext('2d');
  measure.font = text;

  // Content box from the 0.1–99.9 % quantiles of lit pixels, so stray specks do not widen it.
  const contentBox = (image) => {
    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    const columns = new Float64Array(image.width);
    const rows = new Float64Array(image.height);
    let lit = 0;
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const i = (y * image.width + x) * 4;
        if (Math.max(data[i], data[i + 1], data[i + 2]) > 12) {
          columns[x]++;
          rows[y]++;
          lit++;
        }
      }
    }
    if (lit < image.width * image.height * 0.005) throw new Error('A panel captured nothing, or almost nothing.');
    const quantiles = (counts) => {
      let sum = 0;
      let low = 0;
      let high = counts.length - 1;
      for (let i = 0; i < counts.length; i++) {
        sum += counts[i];
        if (sum <= lit * 0.001) low = i;
        if (sum < lit * 0.999) high = i + 1;
      }
      return [low, high];
    };
    const [left, right] = quantiles(columns);
    const [top, bottom] = quantiles(rows);
    return { cx: (left + right) / 2, cy: (top + bottom) / 2, w: right - left, h: bottom - top };
  };

  // A key is a run of swatches and labels under its panel, wrapped to the panel's width.
  const swatch = Math.round(style.text * 0.72);
  const line = Math.round(style.text * 1.4);
  const keyLines = (keys, room) => {
    const lines = [[]];
    let x = 0;
    for (const key of keys) {
      const w = swatch + 10 + measure.measureText(key.label).width;
      if (x && x + w > room) {
        lines.push([]);
        x = 0;
      }
      lines.at(-1).push({ ...key, x });
      x += w + style.text;
    }
    return keys.length ? lines : [];
  };
  const keys = panels.map((panel, index) => keyLines(panel.keys, slots[index].w));

  // Rows are as tall as their cell and the longest key under it.
  const rows = Math.max(...slots.map((slot) => slot.row + slot.down));
  const keyHeight = Array.from({ length: rows }, (_, row) => Math.max(0, ...slots.map((slot, index) => (
    slot.row + slot.down - 1 === row && keys[index].length ? keys[index].length * line + 14 : 0))));
  const tops = [0];
  for (let row = 0; row < rows; row++) tops.push(tops[row] + band + slots[0].cell + keyHeight[row] + gutter);
  for (const slot of slots) {
    slot.y = tops[slot.row] + band;
    slot.h = tops[slot.row + slot.down - 1] + band + slot.cell - slot.y;
  }
  // A key that belongs to every panel runs under the whole figure.
  const shared = keyLines(figure.key ?? [], width);
  const height = tops[rows] - gutter + (shared.length ? shared.length * line + 14 : 0);
  if (height > maxHeight) throw new Error(`${figure.name} is ${height} px tall; 170 mm is ${maxHeight} px.`);

  // The source window of each panel, in capture pixels.
  const windows = panels.map((panel, index) => {
    const image = pictures[index].light;
    const slot = slots[index];
    const trim = panel.trim ?? 0;
    const whole = { cx: image.width / 2, cy: image.height / 2, w: image.width - 2 * trim, h: image.height - 2 * trim };
    const [x0, y0, x1, y1] = panel.crop ?? [];
    const box = panel.crop
      ? { cx: (x0 + x1) / 2 * image.width, cy: (y0 + y1) / 2 * image.height, w: (x1 - x0) * image.width, h: (y1 - y0) * image.height }
      : panel.fit ? whole : contentBox(image);
    // A close view fills its capture from edge to edge: the slot then takes the middle of it, with no margin.
    const filled = !panel.fit && !panel.crop && box.w > image.width * 0.97 && box.h > image.height * 0.97;
    const margin = panel.fit || panel.crop || filled ? 1 : 1.08;
    let w = box.w * margin;
    let h = box.h * margin;
    if ((w / h > slot.w / slot.h) !== filled) h = w * slot.h / slot.w;
    else w = h * slot.w / slot.h;
    return { cx: box.cx, cy: box.cy, w, h, box };
  });
  // One millimetre spans the same width in every measured panel of the figure.
  if (figure.sameScale) {
    const measured = panels.flatMap((panel, index) => (panel.mm && !panel.fit ? [index] : []));
    const scale = Math.max(...measured.map((index) => panels[index].mm * windows[index].w / slots[index].w));
    for (const index of measured) {
      windows[index].w = slots[index].w * scale / panels[index].mm;
      windows[index].h = slots[index].h * scale / panels[index].mm;
    }
  }

  const result = {};
  for (const [theme, ink] of Object.entries(style.inks)) {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.textBaseline = 'alphabetic';
    panels.forEach((panel, index) => {
      const slot = slots[index];
      const window = windows[index];
      const image = pictures[index][theme];
      // A fitted picture keeps its shape and sits at the slot's top left; a stage fills the slot.
      let { w, h } = slot;
      if (panel.fit) {
        // A panel of the interface is drawn at one size in every figure, cut off at the slot's foot.
        const k = panel.zoom ?? Math.min(slot.w / window.box.w, slot.h / window.box.h, panel.enlarge ?? 1.5);
        w = Math.round(window.box.w * k);
        h = Math.min(Math.round(window.box.h * k), slot.h);
        if (w > slot.w + 1) throw new Error(`Panel ${String.fromCharCode(97 + index)} of ${figure.name} is ${w} px wide in a ${slot.w} px slot.`);
        const top = window.cy - window.box.h / 2;
        Object.assign(window, { w: window.box.w, h: h / k, cy: top + h / k / 2 });
      }
      const x = slot.x + (panel.centre ? Math.round((slot.w - w) / 2) : 0);
      if (panel.ground) {
        context.fillStyle = panel.ground;
        context.fillRect(slot.x, slot.y, slot.w, slot.h);
      } else if (!panel.fit) {
        context.fillStyle = '#000000';
        context.fillRect(slot.x, slot.y, slot.w, slot.h);
      }
      const sx = Math.max(0, window.cx - window.w / 2);
      const sy = Math.max(0, window.cy - window.h / 2);
      const ex = Math.min(image.width, window.cx + window.w / 2);
      const ey = Math.min(image.height, window.cy + window.h / 2);
      const k = w / window.w;
      context.imageSmoothingEnabled = k < 2;
      context.imageSmoothingQuality = 'high';
      context.drawImage(
        image, sx, sy, ex - sx, ey - sy,
        x + (sx - (window.cx - window.w / 2)) * k, slot.y + (sy - (window.cy - window.h / 2)) * k,
        (ex - sx) * k, (ey - sy) * k,
      );

      // Scale bar: a 1-2-5 length up to a quarter of the panel, in the emptier bottom corner.
      if (panel.mm && panel.bar !== false) {
        const perPixel = panel.mm / k;
        const length = panel.bar ?? [100, 50, 20, 10, 5, 2, 1, 0.5].find((mm) => mm / perPixel <= w * 0.25);
        const label = `${length} mm`;
        context.font = text;
        const long = Math.max(length / perPixel, context.measureText(label).width);
        const lit = (left) => {
          const { data } = context.getImageData(left, slot.y + h - style.inset - style.rule - style.text - 12, long, style.rule + style.text + 12);
          let count = 0;
          for (let i = 0; i < data.length; i += 4) if (Math.max(data[i], data[i + 1], data[i + 2]) > 40) count++;
          return count;
        };
        const right = x + w - style.inset - long;
        const left = lit(x + style.inset) < lit(right) ? x + style.inset : right;
        context.fillStyle = panel.barInk ?? '#ffffff';
        context.fillRect(Math.round(left + (long - length / perPixel) / 2), slot.y + h - style.inset - style.rule, Math.round(length / perPixel), style.rule);
        context.textAlign = 'center';
        context.fillText(label, left + long / 2, slot.y + h - style.inset - style.rule - 10);
        context.textAlign = 'left';
      }

      context.fillStyle = ink;
      if (panels.length > 1) {
        context.font = `bold ${style.letter}px "Figure Sans"`;
        context.fillText(String.fromCharCode(97 + index), slot.x, slot.y - band + style.letter - 4);
      }
      context.font = text;
      const drawKeys = (lines, left, top) => lines.forEach((row, at) => {
        const y = top + 14 + at * line;
        for (const key of row) {
          const ramp = key.colour.match(/(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi) ?? [];
          if (ramp.length > 1) {
            const gradient = context.createLinearGradient(left + key.x, 0, left + key.x + swatch, 0);
            ramp.forEach((colour, stop) => gradient.addColorStop(stop / (ramp.length - 1), colour));
            context.fillStyle = gradient;
          } else {
            context.fillStyle = key.colour;
          }
          context.fillRect(left + key.x, y + Math.round((line - swatch) / 2) - 2, swatch, swatch);
          context.fillStyle = ink;
          context.fillText(key.label, left + key.x + swatch + 10, y + style.text);
        }
      });
      drawKeys(keys[index], slot.x, slot.y + slot.h);
      if (index === panels.length - 1) drawKeys(shared, 0, tops[rows] - gutter);
    });
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: style.quality });
    if (blob.type !== 'image/webp') throw new Error('This browser cannot encode WebP.');
    result[theme] = [...new Uint8Array(await blob.arrayBuffer())];
  }
  return result;
}

/** The live-view links of one figure's legend, in the page that shows it. */
async function legendLinks(figure) {
  const file = `${figure.name}-light.webp`;
  const page = figure.to === 'readme' ? 'README.md' : `docs/features/${figure.name.replace(/-\d+$/, '')}.md`;
  const pages = [page, ...(figure.also ?? [])];
  const found = [];
  for (const name of pages) {
    const source = await readFile(join(root, name), 'utf8');
    const at = source.indexOf(file);
    if (at < 0) throw new Error(`${name} does not show ${file}.`);
    // A README legend is the <sub> after the picture; a methods legend is the figure block.
    const end = name === 'README.md' ? source.indexOf('</sub>', at) : source.indexOf('\n```', at);
    found.push([name, [...source.slice(at, end).matchAll(/https:\/\/planumatlas\.com\/#([^\s)"<]+)/g)].map((match) => match[1].replaceAll('&amp;', '&'))]);
  }
  return found;
}

const canonical = (hash) => [...new URLSearchParams(hash)].map(([key, value]) => `${key}=${value.split(',').sort().join(',')}`).sort().join('&');

async function checkLegends(figures) {
  let failures = 0;
  for (const figure of figures) {
    const states = new Set(figure.panels.filter((panel) => panel.state && panel.link !== false).map((panel) => canonical(hashOf(panel.state))));
    for (const [page, links] of await legendLinks(figure)) {
      const linked = new Set(links.map(canonical));
      const missing = [...states].filter((state) => !linked.has(state));
      const extra = [...linked].filter((state) => !states.has(state));
      for (const state of missing) console.log(`${page}: ${figure.name}: no link to the captured state ${state}`);
      for (const state of extra) console.log(`${page}: ${figure.name}: links a state that is not captured: ${state}`);
      failures += missing.length + extra.length;
    }
  }
  if (failures) throw new Error(`${failures} legend link(s) differ from the captured states.`);
  console.log(`The legends of ${figures.length} figures link exactly the captured states.`);
}

const chosen = args.length ? FIGURES.filter((figure) => args.includes(figure.name)) : FIGURES;
if (chosen.length !== (args.length || FIGURES.length)) throw new Error(`Unknown figure in: ${args.join(', ')}`);
if (checkLinks) {
  await checkLegends(chosen);
  process.exit(0);
}

const temporary = await mkdtemp(join(tmpdir(), 'planum-figures-'));
const browser = await chromium.launch({ args: [`--use-angle=${ANGLE}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const every = chosen.flatMap((figure) => figure.panels.map((panel, index) => ({ figure, panel, slot: slotsOf(figure)[index] })));
  // Maps opened in the Overlay tool: downloaded, or written by the plot script. Neither is kept.
  const files = {};
  for (const name of new Set(every.flatMap(({ panel }) => (panel.map ? [panel.map] : [])))) {
    const map = MAPS[name];
    // The file keeps its name: the Overlay tool reads the statistic from it.
    files[name] = join(temporary, map.file ?? basename(new URL(map.url).pathname));
    if (!map.url) continue;
    const response = await fetch(map.url);
    if (!response.ok) throw new Error(`${new URL(map.url).host} answered ${response.status} for ${map.url}`);
    await writeFile(files[name], Buffer.from(await response.arrayBuffer()));
  }
  const jobs = [
    ...every.filter(({ panel }) => panel.plot).map(({ panel, slot }) => `${panel.plot}:${slot.w}x${slot.cell * slot.down + (slot.down - 1) * (STYLE.band + GUTTER)}`),
    ...Object.entries(files).filter(([name]) => !MAPS[name].url).map(([name, path]) => `${name}=${path}`),
  ];
  if (jobs.length) {
    const run = spawnSync('uv', [
      'run', '--no-project', ...PLOT_TOOLS.flatMap((tool) => ['--with', tool]), 'python', '-I',
      join(root, 'scripts/figure_plots.py'), '--out', temporary, '--dpi', String(DPI), ...jobs,
    ], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
    if (run.status !== 0) throw new Error('scripts/figure_plots.py failed.');
  }

  const opened = new Map();
  const contexts = async (scale, theme) => {
    const key = `${scale} ${theme}`;
    if (!opened.has(key)) {
      const context = await browser.newContext({ deviceScaleFactor: scale, colorScheme: theme, locale: 'en-GB', timezoneId: 'UTC', acceptDownloads: true });
      await context.addInitScript(prepare, { theme, css: '.orientation,.scale-bar,.orientation-gizmo{visibility:hidden!important}.stage-keys{display:none!important}' });
      opened.set(key, context);
    }
    return opened.get(key);
  };
  const font = (await readFile(join(root, 'docs/_static/fonts/source-sans-3-latin-wght-normal.woff2'))).toString('base64');
  const data = (bytes) => `data:image/png;base64,${bytes.toString('base64')}`;
  for (const figure of chosen) {
    const panels = [];
    for (const [index, panel] of figure.panels.entries()) {
      const letter = String.fromCharCode(97 + index);
      if (panel.plot) {
        const read = async (theme) => data(await readFile(join(temporary, `${panel.plot}-${theme}.png`)));
        panels.push({ images: { light: await read('light'), dark: await read('dark') }, fit: true, keys: [], enlarge: 1 });
      } else {
        const light = await capture(contexts, panel, 'light', files);
        // A panel of the interface is captured in each theme; the stage and the scan are the same in both.
        const dark = panel.themed ? await capture(contexts, panel, 'dark', files) : null;
        const kind = kindOf(panel);
        panels.push({
          images: { light: data(light.png), dark: dark && data(dark.png) }, keys: light.keys, mm: panel.mm ?? light.mm,
          fit: panel.fit ?? kind !== 'stage', trim: panel.trim, bar: panel.bar, barInk: panel.barInk,
          // `rows` keeps a band of an interface panel, from one height to another in CSS pixels.
          crop: panel.rows ? [0, ...panel.rows.map((row) => row * scaleOf(panel) / light.png.readUInt32BE(20))].toSpliced(2, 0, 1) : panel.crop,
          ground: panel.ground ?? (kind === 'mri' ? '#000000' : undefined), centre: panel.centre ?? kind === 'mri', enlarge: panel.enlarge,
          zoom: ['stage', 'mri', 'download'].includes(kind) || panel.contain ? undefined : (panel.zoom ?? STYLE.panel) / scaleOf(panel),
        });
      }
      console.log(`${figure.name} ${letter}`);
    }
    // `key` names the panel whose colour key stands for the whole figure.
    const key = figure.key === undefined ? [] : panels[figure.key].keys;
    if (figure.key !== undefined) panels[figure.key].keys = [];
    const page = await (await contexts(1, 'light')).newPage();
    const webp = await page.evaluate(compose, {
      figure: { name: figure.name, sameScale: figure.sameScale, key }, slots: slotsOf(figure), panels,
      width: WIDTH, gutter: GUTTER, maxHeight: MAX_HEIGHT, style: STYLE, font,
    });
    await page.close();
    for (const [theme, bytes] of Object.entries(webp)) {
      await writeFile(join(root, OUTPUT[figure.to], `${figure.name}-${theme}.webp`), Uint8Array.from(bytes));
    }
    console.log(`Wrote ${figure.name}`);
  }
} finally {
  await browser.close();
  await rm(temporary, { recursive: true });
}
