/**
 * What a notice offers beside its text (ui/chrome/notice.js:36): a reload, the view before a
 * reveal, or the lesion a placed coordinate replaced.
 */
export type NoticeAction = 'reload' | 'restore' | 'restore-lesion';

/** One standing message, cleared by the next action or by the reader (state/session.js:139). */
export interface Notice {
  text: string;
  action?: NoticeAction | null;
}
