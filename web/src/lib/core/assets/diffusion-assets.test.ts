import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import PUBLISHED from './published-files.ts';
import { ASSET_BASE } from '../../../../build/site.ts';
import { fetchDiffusionAsset, readDiffusionAsset } from './diffusion-assets.ts';
import { publish, recordOf } from './published-test-support.ts';

describe('diffusion assets', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pins the file’s published version and revalidates', async () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const record = recordOf(bytes);
    publish({ 'diffusion/brain.nii.gz': record });
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(bytes));
    const url = 'https://example.test/neuroatlas/diffusion/brain.nii.gz';
    const asset = await fetchDiffusionAsset(url);
    expect(fetch.mock.calls[0][0]).toBe(`${url}?v=${record.sha256.slice(0, 16)}`);
    expect(fetch.mock.calls[0][1]).toMatchObject({ cache: 'no-cache' });
    expect(new Uint8Array(asset.buffer)).toEqual(bytes);
  });

  it('adds the tract records kept off the first visit’s map before reading a tract file', async () => {
    const bytes = new Uint8Array([4, 5, 6]);
    const record = recordOf(bytes);
    publish({ 'models/cdmd/manifest.json': recordOf(new Uint8Array([1])) });
    vi.doMock('./published-elsewhere.ts', () => ({
      default: { 'diffusion/cdmd-sub-013/mcp.trk.gz': record },
    }));
    onTestFinished(() => vi.doUnmock('./published-elsewhere.ts'));
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(bytes));
    const url = 'https://example.test/neuroatlas/diffusion/cdmd-sub-013/mcp.trk.gz';
    const asset = await fetchDiffusionAsset(url);
    expect(fetch.mock.calls[0][0]).toBe(`${url}?v=${record.sha256.slice(0, 16)}`);
    expect(new Uint8Array(asset.buffer)).toEqual(bytes);
  });

  it('reads from the published root, not the app base', async () => {
    const bytes = new Uint8Array([1, 2]);
    publish({ 'diffusion/snail-subject-1/t1.nii.gz': recordOf(bytes) });
    PUBLISHED.base = ASSET_BASE;
    vi.stubGlobal('location', { href: 'https://example.test/neuroatlas/' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(bytes));
    const asset = await readDiffusionAsset('snail-subject-1/t1.nii.gz');
    expect(asset.url).toBe(`${ASSET_BASE}diffusion/snail-subject-1/t1.nii.gz`);
  });

  it('reports the HTTP error of a missing file', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 404 }));
    await expect(fetchDiffusionAsset('https://example.test/missing.trk.gz')).rejects.toMatchObject({
      code: 'asset-fetch',
      status: 404,
      message: expect.stringMatching(/missing\.trk\.gz/),
    });
  });
});
