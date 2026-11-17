// One view of Planum inside a course page: the frame's address, its code and what it downloads.
import type { CutMode, Language, ViewName } from '../types/index.ts';
import { atlasSwitchLabel, t } from './i18n/index.ts';

/**
 * What the opening view downloads, in the page's megabytes (2^20 bytes, as the load progress counts):
 * the manifest, the data it names, the Destrieux cortex and the teaching set, 21,382,421 bytes as
 * planumatlas.com served them gzip-compressed on 2026-11-16. A link naming another atlas or internal
 * anatomy loads about 12 to 30 MB (docs/features/sharing-and-snapshots.md).
 */
export const OPENING_DOWNLOAD_MB = 20;

/** The address with `embed=1` last in its hash, or with no `embed` at all; the rest as written. */
export function withEmbed(href: string, embedded: boolean): string {
  const url = new URL(href);
  const pairs = url.hash
    .replace(/^#/, '')
    .split('&')
    .filter((pair) => pair && pair.split('=')[0] !== 'embed');
  if (embedded) pairs.push('embed=1');
  url.hash = pairs.join('&');
  return url.href;
}

/** What the frame's title names: the subject, the atlas, then the section or the view the camera holds. */
export interface EmbedView {
  subject: string;
  atlas: string;
  view: ViewName | null;
  section: Exclude<CutMode, 'off'> | null;
}

export function embedTitle(lang: Language, { subject, atlas, view, section }: EmbedView): string {
  const shown = section
    ? t(lang, 'cuts').sectionNames[section]
    : view && t(lang, 'viewport').namedView(t(lang, 'views')[view]);
  return ['Planum', subject, atlasSwitchLabel(atlas, lang), shown].filter(Boolean).join(' · ');
}

const attribute = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

/**
 * The `<iframe>` a course page pastes: the view at `href`, embedded, fetched only when scrolled near
 * and allowed full screen. A width and height give it a usable size where the page sets none.
 */
export function embedCode(href: string, title: string): string {
  return (
    `<iframe src="${attribute(withEmbed(href, true))}" title="${attribute(title)}" ` +
    'width="800" height="600" loading="lazy" allow="fullscreen" style="border: 0; max-width: 100%">' +
    '</iframe>'
  );
}
