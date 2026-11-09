import { ASSET_BASE } from '../../../build/site.ts';

/** The methods page, `docs/features/<page>.md`, that documents each tool and feature. */
export const METHODS_PAGES = {
  section: 'sections-and-cuts',
  lesion: 'lesion-report',
  coordinate: 'published-coordinates',
  overlay: 'overlays',
  functions: 'functions',
  deficits: 'deficits',
  tracts: 'tracts',
} as const;

export type MethodsPage = keyof typeof METHODS_PAGES;

/** The methods site, which deploy.yml builds from docs/ into the published site's docs/. */
export function methodsHref(page?: MethodsPage): string {
  return page ? `${ASSET_BASE}docs/features/${METHODS_PAGES[page]}.html` : `${ASSET_BASE}docs/`;
}
