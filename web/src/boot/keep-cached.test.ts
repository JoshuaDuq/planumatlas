import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnseenFile } from '../lib/core/assets/asset-cache.ts';
import { keepAnatomyCached } from './keep-cached.ts';

const handOverUnseen = vi.hoisted(() => vi.fn());
const releaseUnseen = vi.hoisted(() => vi.fn());
vi.mock('../lib/core/assets/asset-cache.ts', () => ({ handOverUnseen, releaseUnseen }));

/** A worker that never becomes ready, as when registration fails. */
const never = new Promise<never>(() => {});

describe('keepAnatomyCached', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('registers sw.js at the app base in a built site', () => {
    const register = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { serviceWorker: { register, ready: never } });
    vi.stubEnv('PROD', true);
    keepAnatomyCached();
    expect(register).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    });
  });

  it('does nothing in development, or without service workers', () => {
    const register = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { serviceWorker: { register, ready: never } });
    vi.stubEnv('PROD', false);
    keepAnatomyCached();
    vi.stubEnv('PROD', true);
    vi.stubGlobal('navigator', {});
    keepAnatomyCached();
    expect(register).not.toHaveBeenCalled();
  });

  it('warns when registration fails rather than passing unseen', async () => {
    const failure = new Error('no sw.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: async () => {
          throw failure;
        },
        ready: never,
      },
    });
    vi.stubEnv('PROD', true);
    keepAnatomyCached();
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith('Service worker registration failed:', failure),
    );
    // No worker will take the first visit's copies.
    expect(releaseUnseen).toHaveBeenCalledTimes(1);
  });

  it('SW-01 hands the active worker the files downloaded before it took control', async () => {
    const postMessage = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: async () => undefined,
        ready: Promise.resolve({ active: { postMessage } }),
      },
    });
    vi.stubEnv('PROD', true);
    keepAnatomyCached();
    await vi.waitFor(() => expect(handOverUnseen).toHaveBeenCalledTimes(1));
    const file = { url: 'https://example.test/a.glb?v=1' } as UnseenFile;
    handOverUnseen.mock.calls[0]![0](file);
    expect(postMessage).toHaveBeenCalledWith(file);
  });
});
