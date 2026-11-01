/** What a notice offers beside its text (ui/chrome/notice.js:36): a reload, seeing through the cortex, or the view before a reveal. */
export type NoticeAction = 'reload' | 'see-through' | 'restore';

/** One standing message, cleared by the next action or by the reader (state/session.js:139). */
export interface Notice {
  text: string;
  action?: NoticeAction | null;
}
