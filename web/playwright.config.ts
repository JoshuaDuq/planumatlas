import { defineConfig, devices } from '@playwright/test';

// The journeys run against the built site, served as GitHub Pages serves it
// (e2e/serve-site.mjs). Build it into web/dist first:
//   npm run build        (web/)
const origin = 'http://127.0.0.1:4173';
const PHONE_SMOKE = '**/phone-smoke.spec.ts';

export default defineConfig({
  testDir: './e2e/journeys',
  testMatch: '**/*.spec.ts',
  // Software WebGL makes the first frame slow to settle.
  timeout: 180_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    // The trailing slash matters: relative URLs in the journeys resolve under the app.
    baseURL: `${origin}/`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: PHONE_SMOKE,
      use: {
        browserName: 'chromium',
        // Software WebGL, as in the browser tests (vitest.config.ts).
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
    {
      // WebKit has no switch for its GL path, so it gets no launch flags: it must give WebGL 2 with
      // EXT_color_buffer_float (src/app/webgl-check.ts) by itself, which the smoke's boot checks first.
      name: 'webkit-iphone',
      testMatch: PHONE_SMOKE,
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'node e2e/serve-site.mjs',
    url: `${origin}/`,
    reuseExistingServer: !process.env.CI,
  },
});
