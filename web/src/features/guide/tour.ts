// How to use Planum, as a driver.js tour over the live interface.
import { driver, type DriveStep, type Side, type Alignment } from 'driver.js';
import { t } from '../../lib/core/i18n/index.ts';
import type { GuideStop } from '../../lib/core/i18n/areas/guide.ts';
import { PREF_KEYS, readPref, writePref } from '../../lib/state/prefs.ts';
import { PHONE_QUERY } from '../../lib/types/index.ts';
import type { Language } from '../../lib/types/index.ts';
import './tour.css';

const dock = (n: number) => `.stage-toolbar .popover-host:nth-child(${n}) > button`;
const STAGE = '#viewport canvas';
const tab = (id: string) => `#workspace-tab-${id}`;
const MRI_DOCK = '.mpr-dock';
const PRECENTRAL = 'destrieux:left:29';
/**
 * What the reader works in above the dock, where the dock stops' cards sit: a stage tool's menu,
 * and the bar that moves the cut.
 */
const STAGE_PANELS = '.popover.stage-popover, .section-bar';
const PANEL_GAP = 8;

/**
 * Moves the card beside what the reader works in above the dock, rather than over it: to its right
 * where the window has room, else above it. Moved, the card's arrow no longer meets the control,
 * so it goes; the control keeps its ring.
 */
function clearPanels(card: HTMLElement) {
  // Where driver.js placed the card: its box less the step it is part-way through.
  const [x = 0, y = 0] = getComputedStyle(card)
    .translate.split(' ')
    .map((value) => parseFloat(value) || 0);
  const box = card.getBoundingClientRect();
  const c = { left: box.left - x, right: box.right - x, top: box.top - y, bottom: box.bottom - y };
  // The panels stack in one column over the dock: the card clears them as one.
  const shown = [...document.querySelectorAll(STAGE_PANELS)]
    .filter((panel) => panel.getClientRects().length)
    .map((panel) => panel.getBoundingClientRect());
  let next = '';
  if (shown.length) {
    const m = {
      left: Math.min(...shown.map((r) => r.left)),
      right: Math.max(...shown.map((r) => r.right)),
      top: Math.min(...shown.map((r) => r.top)),
      bottom: Math.max(...shown.map((r) => r.bottom)),
    };
    if (c.right > m.left && c.left < m.right && c.bottom > m.top && c.top < m.bottom) {
      const right = m.right + PANEL_GAP - c.left;
      next =
        c.right + right <= innerWidth - PANEL_GAP
          ? `${right}px 0`
          : `0 ${m.top - PANEL_GAP - c.bottom}px`;
    }
  }
  if (card.style.translate !== next) card.style.translate = next;
  card.toggleAttribute('data-aside', next !== '');
}
/** The scan's download, when the cut before has not already brought it. */
const MRI_WAIT_MS = 10_000;

/**
 * Where each stop points, the side its card takes, and the view it opens, as link parameters over
 * the tour's own home view: each stop shows its feature on the brain rather than describing it.
 */
const STOPS: Record<
  GuideStop['id'],
  {
    selector?: string;
    side?: Side;
    align?: Alignment;
    view?: string;
    /** The region the Linked MRI opens on. */
    opensMri?: string;
  }
> = {
  welcome: {},
  brain: {
    selector: STAGE,
    side: 'left',
    align: 'center',
    view: `region=${PRECENTRAL}`,
  },
  directions: {
    selector: '.orientation-gizmo',
    side: 'left',
    align: 'start',
    view: 'view=superior',
  },
  section: { selector: dock(1), side: 'top', align: 'start', view: 'cut=coronal' },
  // The panel is not part of a link: the stop opens it on the left precentral gyrus.
  linkedMri: {
    selector: MRI_DOCK,
    side: 'left',
    align: 'start',
    view: `cut=coronal&region=${PRECENTRAL}`,
    opensMri: PRECENTRAL,
  },
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
let current: { finish(options?: { restore?: boolean }): void } | null = null;

const rendered = (selector: string) =>
  (document.querySelector(selector)?.getClientRects().length ?? 0) > 0;

/**
 * Builds the stops from what the layout shows now: a control it hides is left out, so the count
 * stays true. Each stop keeps its selector, not the element: the masthead re-renders as the
 * settings menu closes, and a detached element measures as an empty box at the corner. A stop
 * that points at a control leaves the page live, so the reader can try it; only the welcome dims
 * the page. Closing the tour, however it closes, puts the reader's own view back.
 */
interface GuideOptions {
  animate: boolean;
  onClose: () => void;
  /** The settings menu's language choice, offered on the first card. */
  onLanguage: (next: Language) => void;
  /** The Linked MRI, docked beside the stage, opened on a region it selects. */
  mri: { open(region: string): unknown; close(): void };
}

/** The languages the first card offers, each named in itself. */
const LANGUAGES: readonly { value: Language; name: string }[] = [
  { value: 'en', name: 'English' },
  { value: 'fr', name: 'Français' },
];

/** The reader's link in another language: a link that names none keeps the app's own. */
const inLanguage = (hash: string, next: Language) =>
  hash.replace(/([#&])lang=[^&]*/, `$1lang=${next}`);

export function startGuide(lang: Language, options: GuideOptions): void {
  current?.finish();
  writePref(PREF_KEYS.guide, SEEN);
  drive(lang, options, location.hash);
}

/** The tour in one language, over the reader's view `reader`, which closing puts back. */
function drive(lang: Language, options: GuideOptions, reader: string): void {
  const { animate, onClose, onLanguage, mri } = options;
  const copy = t(lang, 'guide');
  const home = parameters(reader).filter(([key]) => HOME_PARAMS.includes(key));
  // A stop's parameters replace the home view's own.
  const show = (view = '') =>
    showHash(
      `#${[...new Map([...home, ...parameters(view)])].map((pair) => pair.join('=')).join('&')}`,
    );
  // Whether the MRI stop opened the panel, so leaving it closes only what the tour opened.
  let openedMri = false;
  // The link the view writes is applied later; the region is selected now, so the MRI opens on it.
  const openMri = (view: string, region: string) => {
    openedMri = !document.querySelector(MRI_DOCK);
    show(view);
    mri.open(region);
  };
  const leaveMri = () => {
    if (!openedMri) return;
    openedMri = false;
    mri.close();
    // The stage widens back: the next card is placed against the settled layout.
    requestAnimationFrame(() => tour.refresh());
  };
  // On a phone the MRI is a modal dialog, which a card cannot point beside.
  const docksMri = rendered(STAGE) && !matchMedia(PHONE_QUERY).matches;
  // What a stop does before it is shown; the card waits for the panel it opens.
  const enter: ((() => void) | null)[] = [];
  const steps: DriveStep[] = copy.stops.flatMap(({ id, title, body }) => {
    const { selector, side, align, view = '', opensMri } = STOPS[id];
    if (opensMri ? !docksMri : selector && !rendered(selector)) return [];
    enter.push(opensMri ? () => openMri(view, opensMri) : null);
    return [
      {
        element: selector,
        ...(opensMri && { waitForElement: MRI_WAIT_MS }),
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
  const move = (index: number) => {
    const opening = enter[index];
    if (opening) opening();
    else leaveMri();
    tour.moveTo(index);
  };
  // A panel opens, closes or settles from its entrance: the card is placed against it again.
  let card: HTMLElement | null = null;
  let placing = 0;
  const placeCard = () => {
    placing ||= requestAnimationFrame(() => {
      placing = 0;
      if (card?.isConnected) clearPanels(card);
    });
  };
  const menus = new MutationObserver(placeCard);
  menus.observe(document.body, { childList: true, subtree: true });
  const settled = ['transitionend', 'animationend'] as const;
  for (const type of settled) document.addEventListener(type, placeCard, true);
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
    onNextClick: () => {
      const index = tour.getActiveIndex()! + 1;
      if (index < steps.length) move(index);
      else finish();
    },
    onPrevClick: () => move(tour.getActiveIndex()! - 1),
    onPopoverRender: ({ wrapper, title, description, nextButton, previousButton }) => {
      wrapper.lang = lang;
      card = wrapper;
      placeCard();
      if (tour.getActiveIndex() === 0) description.append(languageChoice());
      // driver.js focuses the first control, the close button, right after this hook.
      queueMicrotask(() => nextButton.focus());
      title.setAttribute('role', 'heading');
      title.setAttribute('aria-level', '2');
      wrapper.addEventListener('keydown', (event) => {
        if (!CARD_KEYS.has(event.key)) return;
        event.preventDefault();
        if (event.key === 'Escape') finish();
        else if (event.key === 'ArrowRight') nextButton.click();
        else if (event.key === 'ArrowLeft' && tour.hasPreviousStep()) previousButton.click();
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
  /** The first card's language choice: the app changes language and the tour starts again in it. */
  function languageChoice() {
    const row = document.createElement('div');
    row.className = 'guide-languages';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', t(lang, 'header').languageSwitch);
    for (const { value, name } of LANGUAGES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.lang = value;
      button.textContent = name;
      button.setAttribute('aria-pressed', String(value === lang));
      button.addEventListener('click', () => {
        if (value === lang) return;
        onLanguage(value);
        self.finish({ restore: false });
        drive(value, options, inLanguage(reader, value));
      });
      row.append(button);
    }
    return row;
  }
  const self = {
    /** Ends the tour; a restart in another language keeps the reader's view for its own close. */
    finish({ restore = true } = {}) {
      if (current !== self) return;
      current = null;
      menus.disconnect();
      cancelAnimationFrame(placing);
      for (const type of settled) document.removeEventListener(type, placeCard, true);
      leaveMri();
      tour.destroy();
      document.documentElement.removeAttribute(SHOWING);
      if (!restore) return;
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
