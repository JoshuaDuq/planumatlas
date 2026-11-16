import { countTract } from './tract-count.ts';
import type { CountJob, CountReply } from './tract-count.ts';
import { decodeTract } from './tract-decode.ts';
import type { TractJob, TractReply } from './tract-decode.ts';

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<TractJob | CountJob>) => void) | null;
  postMessage(message: TractReply | CountReply, transfer: Transferable[]): void;
};

scope.onmessage = async ({ data }) => {
  if ('file' in data) {
    scope.postMessage(await countTract(data), []);
    return;
  }
  const { reply, transfer } = await decodeTract(data);
  scope.postMessage(reply, transfer);
};
