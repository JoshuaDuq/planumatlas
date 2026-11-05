// How to use Planum, as a driver.js tour over the live interface.
import { driver, type DriveStep, type Side, type Alignment } from 'driver.js';
import { t } from '../../lib/core/i18n/index.ts';
import type { GuideStop } from '../../lib/core/i18n/areas/guide.ts';
import { PREF_KEYS, readPref, writePref } from '../../lib/state/prefs.ts';
import type { Language } from '../../lib/types/index.ts';
import './tour.css';

const dock = (n: number) => `.stage-toolbar .popover-host:nth-child(${n}) > button`;
const STAGE = '#viewport canvas';
const tab = (id: string) => `#workspace-tab-${id}`;

/**
 * Where each stop points, the side its card takes, and the view it opens, as link parameters over
 * the tour's own home view: each stop shows its feature on the brain rather than describing it.
 */
const STOPS: Record<
  GuideStop['id'],
  { selector?: string; side?: Side; align?: Alignment; view?: string }
> = {
  welcome: {},
  brain: {
    selector: STAGE,
    side: 'left',
    align: 'center',
    view: 'region=destrieux:left:29',
  },
  directions: {
    selector: '.orientation-gizmo',
    side: 'left',
    align: 'start',
    view: 'view=superior',
  },
  section: { selector: dock(1), side: 'top', align: 'start', view: 'cut=coronal' },
  // The left precentral gyrus's centroid on this brain (its detail view's Centroid, surface RAS).
  lesion: { selector: dock(2), side: 'top', align: 'start', view: 'lesion=-35.5,-9.5,63.5,10' },
  coordinate: {
    selector: dock(3),
    side: 'top',
    align: 'start',
    view: 'coord=-38,-22,56&space=mni152nlin2009casym',
  },
  medial: { selector: dock(4), side: 'top', align: 'center', view: 'hemi=left&view=right' },
  topBar: { selector: '#masthead .data-bar', side: 'bottom', align: 'center' },
  functions: {
    selector: tab('functions'),
    side: 'right',
    align: 'start',
    // A function is painted on HCP-MMP; opening one in the app switches the atlas and cuts too.
    view: 'atlas=hcp-mmp&cuts=hcp-mmp&tab=functions&function=language',
  },
  deficits: {
    selector: tab('deficits'),
    side: 'right',
    align: 'start',
    view: 'tab=deficits&deficit=aphasia',
  },
  circuits: {
    selector: tab('circuits'),
    side: 'right',
    align: 'start',
    view: 'tab=circuits&circuit=vision',
  },
  tracts: { selector: tab('diffusion'), side: 'right', align: 'start', view: 'tab=diffusion' },
  settings: { selector: '.masthead-end .popover-host > button', side: 'bottom', align: 'end' },
};

/** What the tour keeps of the reader's view: the brain, its atlases and the language. */
const HOME_PARAMS = ['anatomy', 'atlas', 'cuts', 'detail', 'lang'];

const parameters = (hash: string) =>
  hash
    .replace(/^#/, '')
    .split('&')
    .filter(Boolean)
    .map((pair) => pair.split('=') as [string, string]);

/**
 * Shows a view as a link would, without a history entry per stop: the app restores the hash it
 * finds on `hashchange` (links.onHashChange).
 */
function showHash(hash: string) {
  if (location.hash === hash) return;
  history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
  dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Keys the card answers, claimed from the page's keymap; elsewhere on the page they stay the page's. */
const CARD_KEYS = new Set(['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

const SHOWING = 'data-guide-showing';
const SEEN = 'seen';

const HIGHLIGHT_ARIA = ['aria-haspopup', 'aria-expanded', 'aria-controls'];

/** The tour on screen, closed by its own way out when another starts. */
let current: { finish(): void } | null = null;

const rendered = (selector: string) =>
  (document.querySelector(selector)?.getClientRects().length ?? 0) > 0;

/**
 * Builds the stops from what the layout shows now: a control it hides is left out, so the count
 * stays true. Each stop keeps its selector, not the element: the masthead re-renders as the
 * settings menu closes, and a detached element measures as an empty box at the corner. A stop
 * that points at a control leaves the page live, so the reader can try it; only the welcome dims
 * the page. Closing the tour, however it closes, puts the reader's own view back.
 */
export function startGuide(
  lang: Language,
  { animate, onClose }: { animate: boolean; onClose: () => void },
): void {
  current?.finish();
  writePref(PREF_KEYS.guide, SEEN);
  const copy = t(lang, 'guide');
  const reader = location.hash;
  const home = parameters(reader).filter(([key]) => HOME_PARAMS.includes(key));
  // A stop's parameters replace the home view's own.
  const show = (view = '') =>
    showHash(
      `#${[...new Map([...home, ...parameters(view)])].map((pair) => pair.join('=')).join('&')}`,
    );
  const steps: DriveStep[] = copy.stops.flatMap(({ id, title, body }) => {
    const { selector, side, align, view } = STOPS[id];
    if (selector && !rendered(selector)) return [];
    return [
      {
        element: selector,
        popover: { title, description: body, side, align },
        onHighlightStarted: () => {
          show(view);
          // driver.js's class on the body dims the page and makes it inert around the target.
          document.documentElement.toggleAttribute(SHOWING, Boolean(selector));
          document.body.classList.toggle('driver-active', !selector);
        },
      },
    ];
  });
  const tour = driver({
    steps,
    animate,
    showProgress: true,
    progressText: copy.progress,
    nextBtnText: copy.next,
    prevBtnText: copy.previous,
    doneBtnText: copy.done,
    closeBtnLabel: copy.close,
    popoverClass: 'guide-card',
    overlayColor: 'var(--overlay-halo-core)',
    overlayOpacity: 0.5,
    stagePadding: 6,
    stageRadius: 6,
    popoverOffset: 8,
    // The reader tries what a stop points at; a click outside the card never ends the tour.
    disableActiveInteraction: false,
    overlayClickBehavior: 'none',
    // The card answers its keys itself, so Escape in an open menu closes the menu, not the tour.
    allowKeyboardControl: false,
    onPopoverRender: ({ wrapper, title, nextButton }) => {
      wrapper.lang = lang;
      // driver.js focuses the first control, the close button, right after this hook.
      queueMicrotask(() => nextButton.focus());
      title.setAttribute('role', 'heading');
      title.setAttribute('aria-level', '2');
      wrapper.addEventListener('keydown', (event) => {
        if (!CARD_KEYS.has(event.key)) return;
        event.preventDefault();
        if (event.key === 'Escape') finish();
        else if (event.key === 'ArrowRight') tour.moveNext();
        else if (event.key === 'ArrowLeft' && tour.hasPreviousStep()) tour.movePrevious();
      });
    },
    // driver.js marks the target as opening the card, which a canvas, toolbar or tab list may
    // not carry; it restores the target's own attributes when the stop ends.
    onHighlighted: (element) => {
      for (const name of HIGHLIGHT_ARIA) element?.removeAttribute(name);
    },
    // Done and the close button pass here; `onDestroyed` is skipped when the tour ends before a
    // stop's first frame.
    onDestroyStarted: () => finish(),
  });
  const self = {
    finish() {
      if (current !== self) return;
      current = null;
      tour.destroy();
      document.documentElement.removeAttribute(SHOWING);
      showHash(reader);
      onClose();
    },
  };
  const finish = () => self.finish();
  current = self;
  tour.drive();
}

/**
 * Whether to start the tour by itself: on a first visit, and only to a page opened plainly, since a
 * link someone shared opens a view the reader came to see. Starting the tour, by hand or not,
 * counts as having seen it.
 */
export function firstLaunch(hash: string): boolean {
  if (readPref(PREF_KEYS.guide) === SEEN) return false;
  return parameters(hash).every(([key]) => HOME_PARAMS.includes(key));
}
