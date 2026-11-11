/**
 * What a notice offers beside its text (ui/chrome/notice.js:36): a reload, the failed command again,
 * the view before a reveal, the lesion a placed coordinate replaced, or the region a stage click replaced.
 */
export type NoticeAction = 'reload' | 'retry' | 'restore' | 'restore-lesion' | 'undo-pick';

/**
 * One standing message (state/session.js:139). An error stands until the reader dismisses or
 * retries it, or the same command succeeds; information until the next action.
 */
export interface Notice {
  kind: 'error' | 'info';
  text: string;
  action?: NoticeAction | null;
  /** The failed command, as it was asked: what `retry` runs. */
  retry?: () => void;
  /** Which failure an error is (`failureKey`, or a masthead control): a later success of the same clears it. */
  key?: string;
}

/**
 * The notice the session shows: every standing notice joined, errors first. `parts` are those
 * notices, each numbered once when it arrived, so the announcer says each once, however the
 * joined text changes around it.
 */
export interface ShownNotice extends Notice {
  parts: readonly { id: number; text: string }[];
}
