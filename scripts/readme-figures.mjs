/** Render the README figures from the viewer as lettered, journal-style panels.
 *
 *   node scripts/readme-figures.mjs [origin] [figure ...]
 *
 * origin defaults to https://planumatlas.com/; name figures to render only those.
 * Needs the Playwright Chromium installed for web/. Each panel is a native capture of the
 * stage (or a linked MRI plane) with the orientation marks, scale bar and controls hidden;
 * panels are cropped to their content, never recoloured, and written as
 * .github/assets/readme/<figure>-light.webp and -dark.webp. The overlay figure loads an HCP
 * group z map from NeuroVault into the viewer's Overlay tool.
 */
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const args = process.argv.slice(2);
const origin = args[0]?.startsWith('http') ? args.shift() : 'https://planumatlas.com/';
const output = fileURLToPath(new URL('../.github/assets/readme/', import.meta.url));

const WIDTH = 2400;
const GUTTER = 24;
const BAND = 64;
const GROUNDS = { light: ['#ffffff', '#000000'], dark: ['#0d1117', '#e6edf3'] };

const base = { anatomy: 'cdmd', lang: 'en', atlas: 'destrieux', cuts: 'destrieux', detail: 'learning' };
const nextbrain = { ...base, detail: 'nextbrain', cuts: 'nextbrain' };
const cut = (state, plane, pos, view) => ({ state: { ...state, cut: plane, pos, view } });
const surface = (state) => ({ state: { ...base, view: 'left', ...state } });
const tracts = (view, ids) => ({ state: { ...base, tab: 'diffusion', view, opacity: '0.16', tracts: ids } });
const keyed = (state) => ({ state: { ...base, ...state }, keys: true, viewport: [1000, 760] });
const mri = (plane, pos, view) => ({ ...cut(base, plane, pos, view), mri: plane });

// HCP motor task, right hand minus the average of all movements: group z, 486 people (NeuroVault image 3161).
const OVERLAY = {
  url: 'https://neurovault.org/media/images/457/tfMRI_MOTOR_RH-AVG_zstat1.nii.gz',
  title: 'Right hand vs average movement', threshold: '10', max: '25',
};
const overlay = (state, extra) => ({ state: { ...base, colors: 'mri', ...state }, overlay: true, ...extra });

const FIGURES = [
  {
    name: 'overview', aspect: 1.36, grid: [[0, 0, 2, 2], [2, 0, 1, 1], [2, 1, 1, 1]],
    panels: [
      { state: { ...nextbrain, view: 'anterior', explode: '1' } },
      tracts('left', 'af-left,cst-left'),
      surface({ atlas: 'hcp-mmp', cuts: 'hcp-mmp', tab: 'functions', function: 'language' }),
    ],
  },
  {
    name: 'cortex', columns: 3, aspect: 1.3, sameScale: true,
    panels: [
      surface({}),
      surface({ atlas: 'hcp-mmp', cuts: 'hcp-mmp' }),
      surface({ atlas: 'julich', cuts: 'julich' }),
      surface({ atlas: 'schaefer', cuts: 'schaefer' }),
      surface({ colors: 'cab-np' }),
      surface({ colors: 'territory' }),
    ],
  },
  {
    name: 'sections', columns: 3, aspect: 1, sameScale: true,
    panels: [
      cut(base, 'sagittal', '-20', 'right'),
      cut(base, 'coronal', '-20', 'anterior'),
      cut(base, 'axial', '12', 'superior'),
      mri('sagittal', '-20', 'right'),
      mri('coronal', '-20', 'anterior'),
      mri('axial', '12', 'superior'),
    ],
  },
  {
    name: 'tracts', columns: 3, aspect: 1, sameScale: true,
    panels: [
      tracts('left', 'slf1-left,slf2-left,slf3-left'),
      tracts('anterior', 'cst-left,cst-right'),
      tracts('superior', 'callosum-1,callosum-2,callosum-3,callosum-4,callosum-5,callosum-6,callosum-7'),
    ],
  },
  {
    name: 'evidence', columns: 3, aspect: 1.05,
    panels: [
      keyed({ atlas: 'hcp-mmp', cuts: 'hcp-mmp', tab: 'functions', function: 'spatial-attention', view: 'right' }),
      keyed({ tab: 'deficits', deficit: 'neglect', view: 'right' }),
      keyed({ region: 'destrieux:left:4', cases: 'M2295,M2272' }),
    ],
  },
  {
    name: 'overlay', aspect: 1.15,
    grid: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 0, 1, 2]],
    panels: [
      overlay({ view: 'left' }, { keys: true, viewport: [1200, 760] }),
      overlay({ cut: 'sagittal', pos: '18', view: 'right' }),
      overlay({ cut: 'coronal', pos: '-22', view: 'anterior' }),
      overlay({ cut: 'coronal', pos: '-22', view: 'anterior' }, { mri: 'coronal' }),
      overlay({ view: 'left' }, { clusters: true, viewport: [1400, 1600] }),
    ],
  },
];

const hashOf = (state) => new URLSearchParams(state).toString().replaceAll('%2C', ',').replaceAll('%3A', ':');

/** Load the overlay map through the Overlay tool, as a reader would; leave its cluster table open if asked. */
async function openOverlay(page, file, clusters) {
  // Overlay is one of Add's choices, not a tool of its own.
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('radio', { name: 'Overlay', exact: true }).click();
  const tool = page.locator('.overlay');
  // HCP volumes are in FSL's MNI152, which the tool offers only as an unstated MNI template.
  await tool.locator('select').first().selectOption('unstated');
  await tool.locator('input[type=file]').setInputFiles(file);
  await tool.locator('input[id^="overlay-threshold"]').fill(OVERLAY.threshold);
  await tool.locator('input[id^="overlay-max"]').fill(OVERLAY.max);
  await tool.getByText('Map settings', { exact: true }).click();
  const title = tool.locator('input[id^="overlay-title"]');
  await title.fill(OVERLAY.title);
  await title.blur();
  await page.locator('#stage-keys').getByText(OVERLAY.title).waitFor({ state: 'attached' });
  if (clusters) {
    await tool.getByText('Map settings', { exact: true }).click();
    await tool.getByText(/^Clusters and peaks/).click();
    await tool.locator('.peaks').waitFor();
  } else {
    await page.keyboard.press('Escape');
  }
}

async function capture(browser, panel, overlayFile) {
  const [width, height] = panel.viewport ?? (panel.mri ? [1600, 1000] : [1400, 1000]);
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: panel.mri || panel.clusters ? 3 : 2, colorScheme: 'light',
  });
  const hidden = '.orientation,.scale-bar,.orientation-gizmo{visibility:hidden!important}'
    + (panel.keys ? '.stage-key-note{display:none!important}' : '.stage-keys{display:none!important}');
  await context.addInitScript((css) => {
    localStorage.setItem('planum.guide', 'seen');
    localStorage.setItem('planum.stage-hint', 'retired');
    localStorage.setItem('planum.theme', 'light');
    document.addEventListener('DOMContentLoaded', () => {
      document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
    });
  }, hidden);
  const page = await context.newPage();
  page.setDefaultTimeout(180_000);
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
    // The camera eases into place and redraws at full resolution once it rests.
    await page.waitForTimeout(4000);
    if (panel.overlay) {
      await openOverlay(page, overlayFile, panel.clusters);
      await page.waitForTimeout(4000);
    }
    let target = page.locator('#viewport');
    if (panel.mri) {
      await page.getByRole('button', { name: 'Linked MRI', exact: true }).first().click();
      target = page.locator(`.mpr-dock section.plane[data-plane="${panel.mri}"] canvas`);
      await target.waitFor({ state: 'visible', timeout: 120_000 });
      await page.waitForTimeout(3000);
    }
    if (panel.clusters) target = page.locator('.overlay .stage-field:has(.peaks)');
    // The dock holds Add, whose Overlay the capture used, and the open tool, so it is hidden only now.
    if (!panel.clusters) await page.addStyleTag({ content: '.stage-dock,.mpr-dock .picture>:not(canvas){visibility:hidden!important}' });
    await page.mouse.move(0, height - 1);
    if (errors.length) throw new Error(errors.join('\n'));
    return await target.screenshot({ animations: 'disabled', timeout: 240_000 });
  } finally {
    await context.close();
  }
}

/** Runs in the page: crop each capture to its content, tile the panels, letter them, encode WebP. */
async function compose({ figure, images, width, gutter, band, grounds }) {
  const load = (src) => new Promise((done, fail) => {
    const image = new Image();
    image.onload = () => done(image);
    image.onerror = fail;
    image.src = src;
  });
  const pictures = await Promise.all(images.map(load));
  const EDGE = 12;

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
    if (!lit) throw new Error('A panel captured nothing.');
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

  const { columns = 3, aspect, grid, sameScale, panels } = figure;
  const cell = (width - gutter * (columns - 1)) / columns;
  const cellHeight = Math.round(cell / aspect);
  // grid places a panel at [column, row, columns spanned, rows spanned]; otherwise panels fill rows.
  const slots = panels.map((_, index) => {
    const [column, row, across, down] = grid?.[index] ?? [index % columns, Math.floor(index / columns), 1, 1];
    return {
      x: Math.round(column * (cell + gutter)), y: row * (band + cellHeight + gutter),
      w: Math.round(across * cell + (across - 1) * gutter), h: down * cellHeight + (down - 1) * (band + gutter),
    };
  });
  const height = Math.max(...slots.map((slot) => slot.y + band + slot.h));

  const windows = panels.map((panel, index) => {
    const image = pictures[index];
    const slot = slots[index];
    // An MRI plane or a table is shown whole, less an EDGE that blends into the page behind it;
    // a stage capture is cropped to its content with a margin.
    const box = panel.fit
      ? { cx: image.width / 2, cy: image.height / 2, w: image.width - 2 * EDGE, h: image.height - 2 * EDGE }
      : contentBox(image);
    const margin = panel.fit ? 1 : 1.08;
    let w = box.w * margin;
    let h = box.h * margin;
    if (w / h > slot.w / slot.h) h = w * slot.h / slot.w;
    else w = h * slot.w / slot.h;
    return { cx: box.cx, cy: box.cy, w, h };
  });
  // One millimetre spans the same width in every stage panel of the figure.
  if (sameScale) {
    const stages = panels.flatMap((panel, index) => (panel.fit ? [] : [index]));
    const scale = Math.max(...stages.map((index) => windows[index].w / slots[index].w));
    for (const index of stages) {
      windows[index].w = slots[index].w * scale;
      windows[index].h = slots[index].h * scale;
    }
  }

  // A slot is filled with its picture's own background, so a whole MRI plane or table sits without seams.
  const fills = panels.map((panel, index) => {
    if (!panel.fit) return '#000000';
    const canvas = new OffscreenCanvas(1, 1);
    const context = canvas.getContext('2d');
    context.drawImage(pictures[index], EDGE, EDGE, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  });

  const result = {};
  for (const [name, [ground, ink]] of Object.entries(grounds)) {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    context.fillStyle = ground;
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = 'high';
    panels.forEach((_, index) => {
      const slot = slots[index];
      const window = windows[index];
      const image = pictures[index];
      const top = slot.y + band;
      context.fillStyle = fills[index];
      context.fillRect(slot.x, top, slot.w, slot.h);
      // Clip the source window to the picture (less its edge if fitted); the rest keeps the slot's fill.
      const edge = panels[index].fit ? EDGE : 0;
      const sx = Math.max(edge, window.cx - window.w / 2);
      const sy = Math.max(edge, window.cy - window.h / 2);
      const ex = Math.min(image.width - edge, window.cx + window.w / 2);
      const ey = Math.min(image.height - edge, window.cy + window.h / 2);
      const kx = slot.w / window.w;
      const ky = slot.h / window.h;
      context.drawImage(
        image, sx, sy, ex - sx, ey - sy,
        slot.x + (sx - (window.cx - window.w / 2)) * kx, top + (sy - (window.cy - window.h / 2)) * ky,
        (ex - sx) * kx, (ey - sy) * ky,
      );
      context.fillStyle = ink;
      context.font = 'bold 46px "Helvetica Neue", Helvetica, Arial, sans-serif';
      context.textBaseline = 'alphabetic';
      context.fillText(String.fromCharCode(97 + index), slot.x, slot.y + 44);
    });
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.9 });
    if (blob.type !== 'image/webp') throw new Error('This browser cannot encode WebP.');
    result[name] = [...new Uint8Array(await blob.arrayBuffer())];
  }
  return result;
}

const chosen = args.length ? FIGURES.filter((figure) => args.includes(figure.name)) : FIGURES;
if (chosen.length !== (args.length || FIGURES.length)) throw new Error(`Unknown figure in: ${args.join(', ')}`);
const temporary = await mkdtemp(join(tmpdir(), 'planum-figures-'));
// The file keeps its name: the Overlay tool reads the statistic from "zstat1".
const overlayFile = join(temporary, basename(new URL(OVERLAY.url).pathname));
if (chosen.some((figure) => figure.panels.some((panel) => panel.overlay))) {
  const response = await fetch(OVERLAY.url);
  if (!response.ok) throw new Error(`NeuroVault answered ${response.status} for ${OVERLAY.url}`);
  await writeFile(overlayFile, Buffer.from(await response.arrayBuffer()));
}
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const figure of chosen) {
    const images = [];
    for (const [index, panel] of figure.panels.entries()) {
      images.push(`data:image/png;base64,${(await capture(browser, panel, overlayFile)).toString('base64')}`);
      console.log(`${figure.name} ${String.fromCharCode(97 + index)}`);
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    const files = await page.evaluate(compose, {
      figure: { ...figure, panels: figure.panels.map((panel) => ({ fit: Boolean(panel.mri || panel.clusters) })) },
      images, width: WIDTH, gutter: GUTTER, band: BAND, grounds: GROUNDS,
    });
    await context.close();
    for (const [name, bytes] of Object.entries(files)) {
      await writeFile(`${output}${figure.name}-${name}.webp`, Uint8Array.from(bytes));
    }
    console.log(`Wrote ${figure.name}`);
  }
} finally {
  await browser.close();
  await rm(temporary, { recursive: true });
}
