import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RELAY } from '../src/features/colophon/feedback.ts';
import {
  ANALYTICS_REPORT,
  ANALYTICS_SCRIPT,
  contentSecurityPolicy,
  inlineScripts,
  pagePolicy,
} from './content-security-policy.ts';

const page = (head: string) =>
  `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n${head}  </head>\n</html>\n`;

/** The plugin's post-order hook, as Vite calls it on the built page. */
function transform(html: string): string {
  const hook = contentSecurityPolicy().transformIndexHtml as {
    order: string;
    handler: (html: string) => string;
  };
  return hook.handler(html);
}

/** The policy in the page's meta tag, by directive. */
function directives(html: string): Map<string, string[]> {
  const policy = html.match(
    /<meta http-equiv="Content-Security-Policy" content="([^"]*)" \/>/,
  )![1]!;
  return new Map(
    policy.split('; ').map((directive) => {
      const [name, ...sources] = directive.split(' ');
      return [name!, sources];
    }),
  );
}

const sha256 = (text: string) =>
  `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

describe('the page policy the build writes', () => {
  it('BUILD-16 runs only in the build, after every other transform', () => {
    const plugin = contentSecurityPolicy();
    expect(plugin.apply).toBe('build');
    expect(plugin.transformIndexHtml).toMatchObject({ order: 'post' });
  });

  it('BUILD-16 goes right after the charset, ahead of every script, and lists each inline script by its hash', () => {
    const theme = '\n      document.documentElement.dataset.theme = "dark";\n    ';
    const html = transform(
      page(
        `    <script>${theme}</script>\n    <script>window.__planumAssets = {};</script>\n` +
          `    <script type="module" crossorigin src="/assets/index-abc.js"></script>\n`,
      ),
    );
    const head = html.split('\n');
    expect(head[3]).toBe('    <meta charset="UTF-8" />');
    expect(head[4]).toMatch(/^ {4}<meta http-equiv="Content-Security-Policy" content="/);
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script'));
    expect(directives(html).get('script-src')).toEqual([
      "'self'",
      ANALYTICS_SCRIPT,
      sha256(theme),
      sha256('window.__planumAssets = {};'),
      "'wasm-unsafe-eval'",
    ]);
  });

  it('BUILD-16 hashes the exact script text as the browser does (RFC 4648 base64 of its UTF-8)', () => {
    // `echo -n "alert('Hello, world.');" | openssl sha256 -binary | openssl base64`, as CSP Level 3's example.
    expect(pagePolicy(["alert('Hello, world.');"])).toContain(
      "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='",
    );
  });

  it('BUILD-16 finds inline scripts only, not those loaded by src', () => {
    expect(
      inlineScripts(
        '<script>a()</script><script type="module" src="/b.js"></script><script defer>c()</script>',
      ),
    ).toEqual(['a()', 'c()']);
  });

  it('BUILD-16 allows the site itself, the feedback relay and the analytics beacon, and nothing by wildcard', () => {
    const policy = directives(transform(page('')));
    expect([...policy.keys()]).toEqual([
      'default-src',
      'script-src',
      'style-src',
      'connect-src',
      'object-src',
      'base-uri',
      'form-action',
    ]);
    expect(policy.get('default-src')).toEqual(["'self'"]);
    expect(policy.get('connect-src')).toEqual(["'self'", new URL(RELAY).origin, ANALYTICS_REPORT]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'none'"]);
    expect(policy.get('form-action')).toEqual(["'none'"]);
    expect([...policy.values()].flat().filter((source) => source.includes('*'))).toEqual([]);
  });

  it('BUILD-16 refuses a page without the charset it goes after', () => {
    expect(() => transform('<html><head><script>a()</script></head></html>')).toThrow(
      /no <meta charset="UTF-8" \/>/,
    );
  });

  it('BUILD-16 the source page carries no policy of its own', () => {
    const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(source).not.toContain('Content-Security-Policy');
  });
});
