import '../../styles/tokens.css';
import manifestUrl from '../../../../public/models/cdmd/manifest.json?url';
import { createEngine } from './index.ts';

/** Boots the real engine on the CDMD manifest (SwiftShader WebGL) and removes its host on dispose. */
export async function bootEngine(width = 1000, height = 700) {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px`;
  document.body.append(host);
  try {
    const engine = await createEngine({ host, manifestUrl, theme: 'light' });
    const dispose = engine.dispose.bind(engine);
    return Object.assign(engine, {
      dispose() {
        try {
          dispose();
        } finally {
          host.remove();
        }
      },
    });
  } catch (error) {
    host.remove();
    throw error;
  }
}
