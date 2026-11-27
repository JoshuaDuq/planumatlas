import { ASSET_BASE } from '../../../../build/site.ts';
import { fetchAsset } from './asset-cache.ts';
import { loadOtherAnatomyFiles } from './published-assets.ts';

export async function readDiffusionAsset(file: string) {
  return fetchDiffusionAsset(`${ASSET_BASE}diffusion/${file}`);
}

export async function fetchDiffusionAsset(url: string) {
  // Every tract dataset's records are kept off the first visit's map (build/published-files.ts).
  await loadOtherAnatomyFiles();
  return { url, buffer: await fetchAsset(url) };
}
