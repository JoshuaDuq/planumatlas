// BUILD-18: the phone smoke, run by the webkit-iphone project (playwright.config.ts) on the nightly
// and hand-started runs only: Planum starts, picks, cuts and opens its sheet in WebKit on an
// iPhone-sized touch screen. The Chromium project runs the other journeys and leaves this one out.
import { expect, test } from '../fixtures.ts';

const sheetHandle = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /^(Expand|Collapse) panel$/ });

/** How much of the stage the sheet covers, in CSS pixels (the stage's `--vis-bottom`). */
const covered = (page: import('@playwright/test').Page) =>
  page
    .locator('#viewport')
    .evaluate((host) => parseFloat(getComputedStyle(host).getPropertyValue('--vis-bottom')));

let errors: Error[];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error));
});

test.afterEach(() => {
  expect(errors.map(String)).toEqual([]);
});

test('boot: this WebKit has what the renderer needs, and a cold start reaches ready', async ({
  app,
}) => {
  const { page } = app;
  await app.gotoHash();
  // What src/app/webgl-check.ts asks of the browser, named here so a failure says which is missing.
  const missing = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'WebGL 2';
    const float = gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return float ? null : 'EXT_color_buffer_float';
  });
  expect(missing, 'missing in this browser').toBeNull();
  await app.ready();
  await expect(page).toHaveTitle('Planum');
  await expect(page.locator('#viewport canvas')).toBeVisible();
});

test('pick: a tap on the brain selects the region under it', async ({ app }) => {
  const { page } = app;
  await app.gotoHash();
  await app.ready();
  // Only the stage above the resting sheet takes a tap.
  await expect.poll(() => covered(page)).toBeGreaterThan(60);
  const stage = (await page.locator('#viewport canvas').boundingBox())!;
  const open = stage.height - (await covered(page));
  const points = [0.5, 0.4, 0.6].flatMap((x) =>
    [0.5, 0.4, 0.6, 0.3].map((y) => ({ x: stage.x + stage.width * x, y: stage.y + open * y })),
  );
  // Tap one point per poll until one lands on the model; a tap on the background selects nothing.
  let probed = 0;
  await expect
    .poll(
      async () => {
        const { x, y } = points[probed++ % points.length]!;
        await page.touchscreen.tap(x, y);
        return app.hash();
      },
      { timeout: 30_000 },
    )
    .toMatch(/(^|&)region=[\w-]+:(left|right|midline):/);
});

test('cut: a coronal cut from a link shows its controls, and a typed position moves it', async ({
  app,
}) => {
  const { page } = app;
  await app.gotoHash({ cut: 'coronal', pos: '12.5' });
  await app.ready();
  const bar = page.getByRole('group', { name: 'Coronal section', exact: true });
  const position = bar.getByRole('textbox', { name: 'Exact cut position in millimetres' });
  // The field shows once the cut is prepared, which on software WebGL takes a while.
  await expect(position).toHaveValue('12.5', { timeout: 60_000 });
  await position.fill('-20');
  await position.press('Tab');
  await expect.poll(() => app.hash()).toMatch(/(^|&)pos=-20(&|$)/);
  expect(await app.hash()).toMatch(/(^|&)cut=coronal(&|$)/);
});

test('sheet: the sheet rests low over the stage, and its handle raises it to half', async ({
  app,
}) => {
  const { page } = app;
  await app.gotoHash();
  await app.ready();
  const handle = sheetHandle(page);
  await expect(handle).toBeVisible();
  await expect.poll(() => covered(page)).toBeGreaterThan(60);
  await handle.tap();
  const stage = (await page.locator('#viewport').boundingBox())!;
  await expect.poll(() => covered(page)).toBeCloseTo(Math.round(stage.height * 0.5), -1);
});
