// Holds a real pointer on an element through CDP, for the press-state browser tests. No stylesheet
// is imported here: each test file brings the styles it measures.
import type {} from '@vitest/browser-playwright';
import { cdp } from 'vitest/browser';

/** Holds the mouse button down on the middle of `element` while `check` runs, then releases it off the element, so nothing is clicked. */
export async function whilePressed(
  element: Element,
  check: () => void | Promise<void>,
): Promise<void> {
  // CDP input lands in the runner's page, which shows this test's frame scaled to fit.
  const frame = window.frameElement!.getBoundingClientRect();
  const scale = frame.width / window.innerWidth;
  const box = element.getBoundingClientRect();
  const x = frame.left + (box.left + box.width / 2) * scale;
  const y = frame.top + (box.top + box.height / 2) * scale;
  const away = { x: frame.left + 1, y: frame.top + frame.height - 1 };
  const session = cdp();
  const mouse = (
    type: 'mouseMoved' | 'mousePressed' | 'mouseReleased',
    at: { x: number; y: number },
    buttons: number,
  ) =>
    session.send('Input.dispatchMouseEvent', {
      type,
      ...at,
      button: type === 'mouseMoved' ? 'none' : 'left',
      buttons,
      clickCount: type === 'mouseMoved' ? 0 : 1,
    });
  await mouse('mouseMoved', { x, y }, 0);
  await mouse('mousePressed', { x, y }, 1);
  try {
    await check();
  } finally {
    await mouse('mouseMoved', away, 1);
    await mouse('mouseReleased', away, 0);
  }
}
