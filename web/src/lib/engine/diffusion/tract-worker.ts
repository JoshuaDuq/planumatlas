import { decodeTract } from './tract-decode.ts';
import type { TractJob, TractReply } from './tract-decode.ts';

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<TractJob>) => void) | null;
  postMessage(message: TractReply, transfer: Transferable[]): void;
};

scope.onmessage = async ({ data }) => {
  const { reply, transfer } = await decodeTract(data);
  scope.postMessage(reply, transfer);
};
