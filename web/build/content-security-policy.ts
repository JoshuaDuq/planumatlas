import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import { RELAY } from '../src/features/colophon/feedback.ts';

const CHARSET = '<meta charset="UTF-8" />';

/** The text of each inline script in a page, as the browser hashes it. */
export function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    ([, text]) => text!,
  );
}

/**
 * The page's Content-Security-Policy. Each source is one the built app loads:
 * - scripts: the bundle; its module workers and the service worker, which `worker-src` leaves to
 *   `script-src`; the head's inline scripts by their hashes; and the WebAssembly the meshopt decoder
 *   compiles (`three/addons/libs/meshopt_decoder.module.js`, which is never asked for its blob workers);
 * - styles: the stylesheets, and inline: the app sets styles through the CSSOM alone, which no
 *   policy governs, but a `style` attribute in template markup (Svelte's, Bits UI's, driver.js's)
 *   would otherwise work in development and be refused in the built site only;
 * - requests: the published files, and the feedback relay;
 * - fonts and images: the site's own files (`default-src`); the saved PNGs and CSVs are downloads.
 * No form is submitted (each is handled in script) and the page sets no `<base>`.
 */
export function pagePolicy(scripts: readonly string[]): string {
  const hashes = scripts.map(
    (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`,
  );
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')} 'wasm-unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${new URL(RELAY).origin}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/**
 * Writes the policy into the built page as a meta tag, since GitHub Pages sends no headers. It runs
 * after every other transform, so it hashes the inline scripts as the page ships them, and goes
 * right after the charset, ahead of any script. Development has no policy: Vite's dev server
 * injects inline scripts of its own.
 */
export function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!html.includes(CHARSET)) throw new Error(`index.html has no ${CHARSET}`);
        const meta = `<meta http-equiv="Content-Security-Policy" content="${pagePolicy(inlineScripts(html))}" />`;
        return html.replace(CHARSET, () => `${CHARSET}\n    ${meta}`);
      },
    },
  };
}
