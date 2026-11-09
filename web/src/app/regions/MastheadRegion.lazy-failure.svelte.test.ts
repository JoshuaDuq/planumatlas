// The guided tour's code failing to load, on the first visit's own start and from the settings menu.
import '../../styles/index.css';
import '../layout.css';
import { afterEach, expect, test, vi } from 'vitest';
import { createShell } from './shell-test-support.ts';

// A module whose evaluation throws, as a chunk a newer deploy removed fails its import.
vi.mock('../../features/guide/tour.ts', () => ({
  get startGuide(): never {
    throw new Error('The tour chunk did not load.');
  },
}));

const shell = createShell();
afterEach(() => shell.close());

test('a tour whose code does not load says so, at the first visit and from the menu', async () => {
  // The failure is logged as well as said.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await shell.open({ hash: '#anatomy=cdmd&lang=en', firstVisit: true });
  const notice = () => shell.app.session.state.notice?.text;
  await vi.waitFor(() => expect(notice()).toBe('Could not start the tour.'));
  expect(document.querySelector('.driver-popover')).toBeNull();
  shell.app.session.notify(null);
  shell.app.ports.startGuide();
  await vi.waitFor(() => expect(notice()).toBe('Could not start the tour.'));
});
