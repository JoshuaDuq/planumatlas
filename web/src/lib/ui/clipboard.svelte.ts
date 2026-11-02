import { announce } from './announcer.svelte.ts';

/** How long "Copied" stands, and the longer time a failure is left to be read. */
export const COPIED_MS = 2000;
export const FAILED_MS = 6000;

export type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Copies text and holds what became of it for the control that asked: shown in place for a
 * moment and said by the page's announcer. A refused write is shown and logged, never dropped.
 */
export function createCopier(words: () => { copied: string; failed: string }) {
  let state = $state<CopyState>('idle');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function settle(next: Exclude<CopyState, 'idle'>) {
    // A write that ends after its control has gone has no one to tell.
    if (disposed) return;
    state = next;
    announce(words()[next]);
    clearTimeout(timer);
    timer = setTimeout(() => (state = 'idle'), next === 'copied' ? COPIED_MS : FAILED_MS);
  }

  return {
    get state() {
      return state;
    },
    async copy(text: string) {
      // Inside the async function, a missing clipboard (an insecure page) rejects like a refusal.
      const write = async () => navigator.clipboard.writeText(text);
      await write().then(
        () => settle('copied'),
        (error: unknown) => {
          console.error(error);
          settle('failed');
        },
      );
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}
