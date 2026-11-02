/**
 * What a notice offers beside its text (ui/chrome/notice.js:36): a reload, seeing through the cortex,
 * the view before a reveal, or the lesion a placed coordinate replaced.
 */
export type NoticeAction = 'reload' | 'see-through' | 'restore' | 'restore-lesion';

/** One standing message, cleared by the next action or by the reader (state/session.js:139). */
export interface Notice {
  text: string;
  action?: NoticeAction | null;
}
