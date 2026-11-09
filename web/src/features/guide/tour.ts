// How to use Planum, as a driver.js tour over the live interface.
import { driver, type DriveStep, type Side, type Alignment } from 'driver.js';
import { t } from '../../lib/core/i18n/index.ts';
import type { GuideStop } from '../../lib/core/i18n/areas/guide.ts';
import { PREF_KEYS, writePref } from '../../lib/state/prefs.ts';
import { HOME_PARAMS, SEEN, parameters } from './first-launch.ts';
import { PHONE_QUERY } from '../../lib/types/index.ts';
import type { Language } from '../../lib/types/index.ts';
import './tour.css';

const dock = (tool: string) => `.stage-tool[data-tool="${tool}"]`;
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
  const { left, top, width, height } = placedBox(card);
  const c = { left, right: left + width, top, bottom: top + height };
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
  setAside(card, next);
}

const setAside = (card: HTMLElement, translate: string) => {
  if (card.style.translate !== translate) card.style.translate = translate;
  card.toggleAttribute('data-aside', translate !== '');
};

/** Where driver.js placed the card: its box less the step it is part-way through. */
function placedBox(card: HTMLElement) {
  const [x = 0, y = 0] = getComputedStyle(card)
    .translate.split(' ')
    .map((value) => parseFloat(value) || 0);
  const box = card.getBoundingClientRect();
  return { left: box.left - x, top: box.top - y, width: box.width, height: box.height };
}

/** The space a card in the stage takes off its right: the card and a gap either side. */
const stageBand = (card: HTMLElement) => card.offsetWidth + 2 * PANEL_GAP;

/** The top of the stage's dock, under which a phone's cards never sit. */
const dockTop = () => document.querySelector('.stage-dock')?.getBoundingClientRect().top;

/**
 * Over the raised sheet under its tabs, so the stage keeps the anatomy, else just above the dock and
 * inside the stage, so the anatomy is framed in the stage's upper part. A phone's card spans the stage.
 */
function placeAtSeat(card: HTMLElement, at: Seat, selector?: string) {
  const c = placedBox(card);
  const tabs = at === 'underTabs' && document.querySelector(selector!)?.getBoundingClientRect();
  if (tabs && tabs.bottom + 2 * PANEL_GAP + c.height <= innerHeight) {
    setAside(card, `0 ${tabs.bottom + PANEL_GAP - c.top}px`);
    return;
  }
  const top = dockTop();
  const stage = document.querySelector(STAGE)?.getBoundingClientRect();
  if (top === undefined || !stage) return;
  // A card narrower than the stage is kept inside it; a phone's spans it as driver.js put it.
  const left =
    c.width + 2 * PANEL_GAP <= stage.width
      ? Math.max(stage.left + PANEL_GAP, Math.min(c.left, stage.right - PANEL_GAP - c.width))
      : c.left;
  setAside(card, `${left - c.left}px ${top - PANEL_GAP - c.height - c.top}px`);
}

/**
 * The band a phone's card takes off the bottom of the stage above the dock, where it lands after
 * stepping aside; a card in the stage's upper half, under the top bar, takes none.
 */
function bottomBand(card: HTMLElement) {
  const top = dockTop();
  const stage = document.querySelector(STAGE)?.getBoundingClientRect();
  if (top === undefined || !stage) return 0;
  const [, y = 0] = card.style.translate.split(' ').map((value) => parseFloat(value) || 0);
  const { top: placed, height } = placedBox(card);
  const cardTop = placed + y;
  // A phone's stage runs on under the sheet: its open part ends at the dock.
  if (cardTop + height / 2 < (stage.top + top) / 2) return 0;
  return Math.max(0, Math.round(top - cardTop + PANEL_GAP));
}

/** The card at the stage's right edge, centred in its height, in the band the anatomy is framed clear of. */
function placeInStage(card: HTMLElement) {
  const stage = document.querySelector(STAGE)!.getBoundingClientRect();
  const c = placedBox(card);
  const left = stage.right - PANEL_GAP - c.width;
  const top = stage.top + (stage.height - c.height) / 2;
  setAside(card, `${left - c.left}px ${top - c.top}px`);
}
/** Where a card sits rather than over the anatomy: a phone's, or one beside the docked MRI. */
type Seat = 'overDock' | 'underTabs';

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
    /** The Linked MRI opens beside the stop on the function or deficit its view paints, as the profile's own does. */
    paintsMri?: true;
    /** The card sits in the stage's dark space, a band the anatomy is framed clear of. */
    inStage?: true;
    /** Where a phone's card sits, rather than over the anatomy. */
    phone?: Seat;
  }
> = {
  welcome: { phone: 'overDock' },
  brain: {
    selector: STAGE,
    side: 'left',
    align: 'center',
    view: `region=${PRECENTRAL}`,
    inStage: true,
    phone: 'overDock',
  },
  directions: {
    selector: '.orientation-gizmo',
    side: 'left',
    align: 'start',
    view: 'view=superior',
  },
  section: { selector: dock('section'), side: 'top', align: 'start', view: 'cut=coronal' },
  // The panel is not part of a link: the stop opens it on the left precentral gyrus.
  linkedMri: {
    selector: MRI_DOCK,
    side: 'left',
    align: 'start',
    view: `cut=coronal&region=${PRECENTRAL}`,
    opensMri: PRECENTRAL,
  },
  // The left precentral gyrus's centroid on this brain (its detail view's Centroid, surface RAS).
  lesion: {
    selector: dock('lesion'),
    side: 'top',
    align: 'start',
    view: 'lesion=-35.5,-9.5,63.5,10',
  },
  // Fox et al. 2012 (Biol Psychiatry, PMID 22658708): the left DLPFC stimulation target that
  // connectivity with the subgenual cingulate optimises, in MNI. The paper names no MNI template,
  // so the stop reads it as not stated and the report gives the other templates' offsets. On this
  // brain it lands in cortex, half its 5 mm sphere in the middle frontal gyrus.
  coordinate: {
    selector: dock('coordinate'),
    side: 'top',
    align: 'start',
    view: 'coord=-38,44,26&space=unstated',
  },
  // A reader's map is their own file and never in a link: the stop points at the tool to try.
  overlay: { selector: dock('overlay'), side: 'top', align: 'start' },
  medial: { selector: dock('display'), side: 'top', align: 'center', view: 'hemi=left&view=right' },
  // The brain comes apart as the stop opens, seen from the front; every other stop's view leaves
  // the explode out, so moving on, going back or closing puts it back together.
  explode: {
    selector: dock('display'),
    side: 'top',
    align: 'center',
    view: 'explode=1&view=anterior',
  },
  topBar: { selector: '#masthead .data-bar', side: 'bottom', align: 'center' },
  functions: {
    selector: tab('functions'),
    side: 'right',
    align: 'start',
    // A function is painted on HCP-MMP; opening one in the app switches the atlas and cuts too.
    view: 'atlas=hcp-mmp&cuts=hcp-mmp&tab=functions&function=language',
    paintsMri: true,
    inStage: true,
    phone: 'underTabs',
  },
  deficits: {
    selector: tab('deficits'),
    side: 'right',
    align: 'start',
    view: 'tab=deficits&deficit=aphasia',
    paintsMri: true,
    inStage: true,
    phone: 'underTabs',
  },
  circuits: {
    selector: tab('circuits'),
    side: 'right',
    align: 'start',
    view: 'tab=circuits&circuit=vision',
    inStage: true,
    phone: 'underTabs',
  },
  tracts: {
    selector: tab('diffusion'),
    side: 'right',
    align: 'start',
    view: 'tab=diffusion',
    inStage: true,
    phone: 'underTabs',
  },
  settings: { selector: '.masthead-end .popover-host > button', side: 'bottom', align: 'end' },
};

/** The function or deficit a stop's view paints. */
export type GuidePaint = { function: string } | { deficit: string };

function paintOf(view: string): GuidePaint {
  const shown = new Map(parameters(view));
  const id = shown.get('function') ?? shown.get('deficit');
  if (!id) throw new Error(`A stop that opens the MRI on its paint paints nothing: ${view}`);
  return shown.has('function') ? { function: id } : { deficit: id };
}

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
  /** `pointer`: the last press that ended the tour was a pointer's, so focus returns without a ring. */
  onClose: (closed: { pointer: boolean }) => void;
  /** The settings menu's language choice, offered on the first card. */
  onLanguage: (next: Language) => void;
  /**
   * The Linked MRI, docked beside the stage: opened on a region it selects, or on a function's or
   * deficit's paint as its profile opens it.
   */
  mri: { open(region: string): unknown; openPaint(paint: GuidePaint): unknown; close(): void };
  /** Keeps bands this wide on the stage's right and above its dock clear of anatomy; 0 gives one back. */
  reserve: (band: { right: number; bottom: number }) => void;
}

/** The presses that say whether the reader is using a pointer or the keyboard. */
const INPUTS = ['pointerdown', 'keydown'] as const;

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
  const { animate, onClose, onLanguage, mri, reserve } = options;
  const copy = t(lang, 'guide');
  const home = parameters(reader).filter(([key]) => HOME_PARAMS.includes(key));
  // A stop's parameters replace the home view's own.
  const show = (view = '') =>
    showHash(
      `#${[...new Map([...home, ...parameters(view)])].map((pair) => pair.join('=')).join('&')}`,
    );
  // Whether the tour opened the panel, so leaving its stops closes only what the tour opened.
  let openedMri = false;
  // The link the view writes is applied later, so the MRI is opened on what the stop names.
  const openMri = (view: string, open: () => unknown) => {
    openedMri ||= !document.querySelector(MRI_DOCK);
    show(view);
    open();
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
  // Whether a stop's card sits in the stage; a phone's stage is under the sheet, so it keeps its own.
  const inStage: boolean[] = [];
  // Where each stop's card sits on a phone, if not where driver.js puts it.
  const seats: { at?: Seat; selector?: string }[] = [];
  const phone = matchMedia(PHONE_QUERY).matches;
  const steps: DriveStep[] = copy.stops.flatMap(({ id, title, body }) => {
    const { selector, side, align, view = '', opensMri, paintsMri } = STOPS[id];
    if (opensMri ? !docksMri : selector && !rendered(selector)) return [];
    const paintDocked = Boolean(paintsMri) && docksMri;
    enter.push(
      opensMri
        ? () => openMri(view, () => mri.open(opensMri))
        : paintDocked
          ? () => openMri(view, () => mri.openPaint(paintOf(view)))
          : null,
    );
    // Beside the docked MRI the stage is too narrow for a band down its right: the card sits over
    // the dock instead, as a phone's does, and the anatomy is framed above it.
    inStage.push(Boolean(STOPS[id].inStage) && !phone && !paintDocked);
    seats.push(phone ? { at: STOPS[id].phone, selector } : paintDocked ? { at: 'overDock' } : {});
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
      if (!card?.isConnected) return;
      const index = tour.getActiveIndex() ?? -1;
      if (inStage[index]) placeInStage(card);
      else if (seats[index]?.at) placeAtSeat(card, seats[index].at, seats[index].selector);
      else clearPanels(card);
      if (phone || seats[index]?.at) reserve({ right: 0, bottom: bottomBand(card) });
    });
  };
  const menus = new MutationObserver(placeCard);
  menus.observe(document.body, { childList: true, subtree: true });
  const settled = ['transitionend', 'animationend'] as const;
  for (const type of settled) document.addEventListener(type, placeCard, true);
  addEventListener('resize', placeCard);
  // How the reader last acted, so the close hands focus back the way it came (WCAG 2.4.7 asks for a
  // ring after the keyboard, not after a tap that ended the tour).
  let pointer = false;
  const pressed = (event: Event) => (pointer = event.type === 'pointerdown');
  for (const type of INPUTS) document.addEventListener(type, pressed, true);
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
      // The anatomy eases out of the band first; the card follows the stage once it has.
      if (!phone)
        reserve({ right: inStage[tour.getActiveIndex()!] ? stageBand(wrapper) : 0, bottom: 0 });
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
      for (const type of INPUTS) document.removeEventListener(type, pressed, true);
      removeEventListener('resize', placeCard);
      reserve({ right: 0, bottom: 0 });
      leaveMri();
      tour.destroy();
      document.documentElement.removeAttribute(SHOWING);
      if (!restore) return;
      showHash(reader);
      onClose({ pointer });
    },
  };
  const finish = () => self.finish();
  current = self;
  tour.drive();
}
