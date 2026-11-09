import { expect, onTestFinished, test, vi } from 'vitest';
import '../../styles/tokens.css';
import manifestUrl from '../../../../public/models/cdmd/manifest.json?url';
import { createEngine } from './index.ts';

vi.setConfig({ testTimeout: 180_000 });

// The real engine on the CDMD manifest: every file a prefetch downloads is asked for at low
// priority, through each loader the cut and the other atlas go through.
test('the cut and atlas prefetches download every file at low priority', async () => {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px';
  document.body.append(host);
  const engine = await createEngine({ host, manifestUrl, theme: 'light' });
  onTestFinished(() => {
    engine.dispose();
    host.remove();
  });
  const fetches = vi.spyOn(globalThis, 'fetch');
  await engine.sections.prefetch();
  await engine.model.prefetchLayer('hcp-mmp');
  const asked = fetches.mock.calls.map(([input, init]) => ({
    file: new URL(String(input)).pathname.split('/').pop(),
    priority: init?.priority,
  }));
  expect(asked.map(({ file }) => file)).toEqual(
    expect.arrayContaining(['tissue-envelopes.glb', 'mri.volume', 'cortex-hcp-mmp.glb']),
  );
  expect(asked.filter(({ priority }) => priority !== 'low')).toEqual([]);
});
