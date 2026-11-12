// How to use Planum, as a driver.js tour over the live interface.
import { driver, type DriveStep, type Side, type Alignment } from 'driver.js';
import { groupsByLobe } from '../../lib/core/catalog/lobes.ts';
import { t } from '../../lib/core/i18n/index.ts';
import type { GuideStop } from '../../lib/core/i18n/areas/guide.ts';
import { CAMERA_KEYS } from '../../lib/engine/held-view.ts';
import { PREF_KEYS, writePref } from '../../lib/state/prefs.ts';
import { HOME_PARAMS, SEEN, parameters } from './first-launch.ts';
import { PHONE_QUERY } from '../../lib/types/index.ts';
import type { Language } from '../../lib/types/index.ts';
import './tour.css';

const dock = (tool: string) => `.stage-tool[data-tool="${tool}"]`;
// Add, where it holds this choice: a stage with no Overlay to offer has no Overlay stop.
const add = (choice: string) => `${dock('place')}[data-offers~="${choice}"]`;
const STAGE = '#viewport canvas';
const tab = (id: string) => `#workspace-tab-${id}`;
const MRI_DOCK = '.mpr-dock';
const PRECENTRAL = 'destrieux:left:29';
/** The link's camera: an exact one, or a named view. */
const CAMERA = ['cam', 'view'];
/**
 * What the reader works in above the dock, where the dock stops' cards sit: a stage tool's menu,
 * and the bar that moves the cut.
 */
const STAGE_PANELS = '.popover.stage-popover, .section-bar';
const PANEL_GAP = 8;
/** How far a press on the brain moves before it is a drag, not a click. */
const DRAG_PX = 12;
/** How long a card that saw the reader do what it asked shows so before moving on. */
const DONE_MS = 700;

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
  if (at === 'stageTop') {
    setAside(card, `0 ${stage.top + PANEL_GAP - c.top}px`);
    return;
  }
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
/**
 * Where a card sits rather than over the anatomy: a phone's, or one beside the docked MRI. A phone's
 * card about the raised sheet sits at the stage's top, over the little anatomy left above the sheet.
 */
type Seat = 'overDock' | 'underTabs' | 'stageTop';

/** What the reader does on the brain for a card that waits: turn it, or open a region. */
type Try = 'turn' | 'pick';

/** The scan's download, when the cut before has not already brought it. */
const MRI_WAIT_MS = 10_000;

/** Marks a card rendered but not yet placed (tour.css). */
const ENTERING = 'data-entering';
/** Marks a card that saw the reader do what it asked (tour.css). */
const DONE = 'data-done';

/**
 * Where each stop points, the side its card takes, and the view it opens, as link parameters over
 * the tour's own home view: each stop shows its feature on the brain rather than describing it.
 */
const STOPS: Record<
  GuideStop['id'],
  {
    selector: string;
    /** What a phone points at instead, where the desktop's target has no box. */
    phoneSelector?: string;
    side: Side;
    align: Alignment;
    view?: string;
    /** The reader's own link parameters the stop keeps over its view: their camera, their region. */
    keeps?: readonly string[];
    /** The card waits for the reader to do what it says on the brain, then moves on. */
    tries?: Try;
    /** The region the reader opened, seen as they left it, replaces the stop's own. */
    readersRegion?: true;
    /** A phone's sheet rises to show what the stop points at, and comes down after it. */
    raisesSheet?: true;
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
  // The brain is the welcome: the card sits beside it, and nothing is dimmed.
  welcome: { selector: STAGE, side: 'left', align: 'center', inStage: true, phone: 'overDock' },
  turn: {
    selector: STAGE,
    side: 'left',
    align: 'center',
    keeps: CAMERA,
    tries: 'turn',
    inStage: true,
    phone: 'overDock',
  },
  openRegion: {
    selector: STAGE,
    side: 'left',
    align: 'center',
    keeps: [...CAMERA, 'region'],
    tries: 'pick',
    inStage: true,
    phone: 'overDock',
  },
  // On the region the reader opened; one who went on without opening one sees the left precentral gyrus.
  regionDetail: {
    selector: '#workspace-panel',
    phoneSelector: '#sheet',
    side: 'right',
    align: 'start',
    view: `region=${PRECENTRAL}`,
    readersRegion: true,
    raisesSheet: true,
    inStage: true,
    phone: 'stageTop',
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
  medial: { selector: dock('display'), side: 'top', align: 'center', view: 'hemi=left&view=right' },
  // The brain comes apart as the stop opens, seen from the front; every other stop's view leaves
  // the explode out, so moving on, going back or closing puts it back together.
  explode: {
    selector: dock('display'),
    side: 'top',
    align: 'center',
    view: 'explode=1&view=anterior',
  },
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
  // The left precentral gyrus's centroid on this brain (its detail view's Centroid, surface RAS).
  lesion: {
    selector: add('lesion'),
    side: 'top',
    align: 'start',
    view: 'lesion=-35.5,-9.5,63.5,10',
  },
  // Fox et al. 2012 (Biol Psychiatry, PMID 22658708): the left DLPFC stimulation target that
  // connectivity with the subgenual cingulate optimises, in MNI. The paper names no MNI template,
  // so the stop reads it as not stated and the report gives the other templates' offsets. On this
  // brain it lands in cortex, half its 5 mm sphere in the middle frontal gyrus.
  coordinate: {
    selector: add('coordinate'),
    side: 'top',
    align: 'start',
    view: 'coord=-38,44,26&space=unstated',
  },
  // A reader's map is their own file and never in a link: the stop points at the tool to try.
  overlay: { selector: add('overlay'), side: 'top', align: 'start' },
  topBar: { selector: '#masthead .data-bar', side: 'bottom', align: 'center' },
  settings: { selector: '.masthead-end .popover-host > button', side: 'bottom', align: 'end' },
  finish: {
    selector: '.workspace-tabs',
    side: 'right',
    align: 'start',
    inStage: true,
    phone: 'underTabs',
  },
};

/** A first visit's tour: the welcome, the brain in the reader's hands, then what to open next. */
const FIRST_VISIT: readonly GuideStop['id'][] = [
  'welcome',
  'turn',
  'openRegion',
  'regionDetail',
  'section',
  'functions',
  'finish',
];

/** A first visit's stops, the rest a first visit left out, or every stop from the settings menu. */
type Kind = 'first' | 'rest' | 'all';

/** The function or deficit a stop's view paints. */
export type GuidePaint = { function: string } | { deficit: string };

function paintOf(view: string): GuidePaint {
  const shown = new Map(parameters(view));
  const id = shown.get('function') ?? shown.get('deficit');
  if (!id) throw new Error(`A stop that opens the MRI on its paint paints nothing: ${view}`);
  return shown.has('function') ? { function: id } : { deficit: id };
}

/** Two links that set the same parameters, in whatever order. */
const sameLink = (a: string, b: string) => {
  const sorted = (hash: string) =>
    parameters(hash)
      .map((pair) => pair.join('='))
      .sort()
      .join('&');
  return sorted(a) === sorted(b);
};

/**
 * Shows a view as a link would, without a history entry per stop: the app restores the hash it
 * finds on `hashchange` (links.onHashChange). A view the page already shows is left alone, so a
 * stop that keeps the reader's camera does not move it.
 */
function showHash(hash: string) {
  if (sameLink(location.hash, hash)) return;
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
 * settings menu closes, and a detached element measures as an empty box at the corner. Every stop
 * leaves the page live, so the reader can try what it shows. Closing the tour, however it closes,
 * puts the reader's own view back.
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
  /** Calls back with each region the reader clicks on the brain from now on; the return stops it. */
  onPick: (listener: (region: string) => void) => () => void;
  /** A phone's sheet: raised to show a region's detail, lowered to give the stage its room back. */
  sheet: { raise(): void; lower(): void };
  /** Keeps bands this wide on the stage's right and above its dock clear of anatomy; 0 gives one back. */
  reserve: (band: { right: number; bottom: number }) => void;
  /** A first visit's short tour, rather than every stop. */
  short?: boolean;
}

/** The presses that say whether the reader is using a pointer or the keyboard. */
const INPUTS = ['pointerdown', 'keydown'] as const;

/** What turning the brain is made of: a drag, a wheel, or a camera key on the canvas. */
const TURNS = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'wheel',
  'keyup',
] as const;

/** The languages the first card offers, each named in itself. */
const LANGUAGES: readonly { value: Language; name: string }[] = [
  { value: 'en', name: 'English' },
  { value: 'fr', name: 'Français' },
];

/** The reader's link in another language: a link that names none keeps the app's own. */
const inLanguage = (hash: string, next: Language) =>
  hash.replace(/([#&])lang=[^&]*/, `$1lang=${next}`);

/** The tour, from the settings menu; a first visit passes `short` for its own stops. */
export function startGuide(lang: Language, options: GuideOptions): void {
  current?.finish();
  writePref(PREF_KEYS.guide, SEEN);
  drive(lang, options, location.hash, options.short ? 'first' : 'all');
}

/** What a stop points at in this layout. */
const targetOf = (id: GuideStop['id'], phone: boolean) =>
  (phone && STOPS[id].phoneSelector) || STOPS[id].selector;

/** The stops a layout can show now: a control it hides is left out, so the count stays true. */
function shownStops(lang: Language, kind: Kind, docksMri: boolean, phone: boolean): GuideStop[] {
  const copy = t(lang, 'guide');
  const all = [...copy.stops, ...copy.firstVisit];
  const stops =
    kind === 'first'
      ? FIRST_VISIT.map((id) => all.find((stop) => stop.id === id)!)
      : kind === 'rest'
        ? copy.stops.filter(({ id }) => !FIRST_VISIT.includes(id))
        : copy.stops;
  return stops.filter(({ id }) => (STOPS[id].opensMri ? docksMri : rendered(targetOf(id, phone))));
}

/** The tour in one language, over the reader's view `reader`, which closing puts back. */
function drive(lang: Language, options: GuideOptions, reader: string, kind: Kind): void {
  const { animate, onClose, onLanguage, mri, onPick, sheet, reserve } = options;
  const copy = t(lang, 'guide');
  // The opening picture's lobes stay through the tour; any other colour gives way to the stops' own.
  const home = parameters(reader).filter(
    ([key, value]) => HOME_PARAMS.includes(key) || (key === 'colors' && value === 'lobe'),
  );
  // A stop's parameters replace the home view's own, over those of the reader's it keeps; a stop on
  // an atlas without lobes shows its regions.
  const show = (view = '', keeps: readonly string[] = []) => {
    const own = parameters(location.hash).filter(([key]) => keeps.includes(key));
    const shown = new Map([...home, ...own, ...parameters(view)]);
    if (shown.get('colors') === 'lobe' && !groupsByLobe(shown.get('atlas'))) shown.delete('colors');
    showHash(`#${[...shown].map((pair) => pair.join('=')).join('&')}`);
  };
  // The region the reader last clicked on the brain during the tour.
  let opened: string | null = null;
  // Whether a phone's sheet is up for the tour's region stops (the app raises it for a pick too).
  let sheetUp = false;
  const lowerSheet = () => {
    if (!sheetUp) return;
    sheetUp = false;
    sheet.lower();
  };
  const viewOf = (id: GuideStop['id']) => {
    const { view = '', keeps = [], readersRegion } = STOPS[id];
    if (readersRegion && opened) return { view: `region=${opened}`, keeps: CAMERA };
    return { view, keeps };
  };
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
  const phone = matchMedia(PHONE_QUERY).matches;
  // On a phone the MRI is a modal dialog, which a card cannot point beside.
  const docksMri = rendered(STAGE) && !phone;
  const stops = shownStops(lang, kind, docksMri, phone);
  // What a stop does before it is shown; the card waits for the panel it opens.
  const enter: ((() => void) | null)[] = [];
  // Whether a stop's card sits in the stage; a phone's stage is under the sheet, so it keeps its own.
  const inStage: boolean[] = [];
  // Where each stop's card sits on a phone, if not where driver.js puts it.
  const seats: { at?: Seat; selector?: string }[] = [];
  const steps: DriveStep[] = stops.map(({ id, title, body }) => {
    const { side, align, view = '', opensMri, paintsMri } = STOPS[id];
    const selector = targetOf(id, phone);
    // A first visit keeps the painted brain large: the MRI beside it is the full tour's.
    const paintDocked = Boolean(paintsMri) && docksMri && kind !== 'first';
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
    return {
      element: selector,
      ...(opensMri && { waitForElement: MRI_WAIT_MS }),
      popover: {
        title,
        description: body,
        side,
        align,
        ...(id === 'welcome' && { nextBtnText: copy.start }),
        ...(kind === 'first' && { doneBtnText: copy.explore }),
      },
      onHighlightStarted: () => {
        const { view: shown, keeps } = viewOf(id);
        show(shown, keeps);
        if (phone && STOPS[id].raisesSheet) {
          sheet.raise();
          sheetUp = true;
        } else lowerSheet();
        // driver.js's class on the body dims the page and makes it inert around the target.
        document.body.classList.remove('driver-active');
      },
    };
  });
  const restStops = shownStops(lang, 'rest', docksMri, phone).length;
  let doneTimer = 0;
  const move = (index: number) => {
    clearTimeout(doneTimer);
    const opening = enter[index];
    if (opening) opening();
    else leaveMri();
    tour.moveTo(index);
  };
  const tries = (index: number | undefined) =>
    index === undefined ? undefined : STOPS[stops[index]!.id].tries;
  // The reader did what the card asked: it says so, then moves on.
  const tried = (what: Try) => {
    const index = tour.getActiveIndex();
    if (tries(index) !== what || !card?.isConnected || card.hasAttribute(DONE)) return;
    card.setAttribute(DONE, '');
    card.querySelector('.guide-try')!.textContent = copy.didIt;
    doneTimer = window.setTimeout(() => {
      if (tour.getActiveIndex() === index) move(index! + 1);
    }, DONE_MS);
  };
  // A drag that moves the brain, a wheel over it or a camera key on it turns it; a click opens a region.
  let press: { x: number; y: number; turned: boolean } | null = null;
  const turning = (event: Event) => {
    const onStage = event.target instanceof Element && event.target.matches(STAGE);
    if (event.type === 'pointerdown') {
      const { clientX: x, clientY: y } = event as PointerEvent;
      press = onStage ? { x, y, turned: false } : null;
    } else if (event.type === 'pointermove') {
      const { clientX, clientY } = event as PointerEvent;
      if (press) press.turned ||= Math.hypot(clientX - press.x, clientY - press.y) > DRAG_PX;
    } else if (event.type === 'pointerup' || event.type === 'pointercancel') {
      if (press?.turned) tried('turn');
      press = null;
    } else if (
      onStage &&
      (event.type === 'wheel' || CAMERA_KEYS.has((event as KeyboardEvent).key))
    ) {
      tried('turn');
    }
  };
  for (const type of TURNS)
    document.addEventListener(type, turning, { capture: true, passive: true });
  // Any click on a region opens it, and on a phone raises the sheet; Open a region waits for one.
  const unpick = onPick((region) => {
    opened = region;
    sheetUp ||= phone;
    tried('pick');
  });
  // A panel opens, closes or settles from its entrance: the card is placed against it again.
  let card: HTMLElement | null = null;
  let placing = 0;
  const placeCard = () => {
    placing ||= requestAnimationFrame(() => {
      placing = 0;
      if (!card?.isConnected) return;
      const index = tour.getActiveIndex() ?? -1;
      // Once picked, a card stays put and gives its band back: on a phone the pick raises the sheet,
      // which would otherwise carry the card up over the anatomy and squeeze it under the card.
      const picked = card.hasAttribute(DONE) && tries(index) === 'pick';
      if (!picked) {
        if (inStage[index]) placeInStage(card);
        else if (seats[index]?.at) placeAtSeat(card, seats[index].at, seats[index].selector);
        else clearPanels(card);
      }
      if (phone || seats[index]?.at) reserve({ right: 0, bottom: picked ? 0 : bottomBand(card) });
      if (card.hasAttribute(ENTERING)) {
        // Read once so the first seat is taken without the transition, then shown; a hidden card
        // cannot hold focus, so Next takes it here.
        void getComputedStyle(card).translate;
        card.removeAttribute(ENTERING);
        card.querySelector<HTMLElement>('.driver-popover-next-btn')?.focus();
      }
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
  document.documentElement.setAttribute(SHOWING, '');
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
    onPopoverRender: ({
      wrapper,
      title,
      description,
      footerButtons,
      nextButton,
      previousButton,
    }) => {
      const index = tour.getActiveIndex()!;
      const { id } = stops[index]!;
      wrapper.lang = lang;
      card = wrapper;
      // A new card waits unseen for its seat, rather than drawing where driver.js put it and sliding over.
      wrapper.setAttribute(ENTERING, '');
      // The anatomy eases out of the band first; the card follows the stage once it has.
      if (!phone) reserve({ right: inStage[index] ? stageBand(wrapper) : 0, bottom: 0 });
      placeCard();
      if (id === 'welcome') {
        description.append(languageChoice());
        footerButtons.prepend(skipButton());
      }
      if (tries(index)) title.before(yourTurn());
      // On a line of its own under the words: beside Back, Done and the count it wrapped the footer.
      if (kind === 'first' && !tour.hasNextStep() && restStops) description.append(restButton());
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
  /** Over a card that waits for the reader: it asks, and says when they have done it. */
  function yourTurn() {
    const line = document.createElement('p');
    line.className = 'guide-try';
    line.setAttribute('aria-live', 'polite');
    line.textContent = copy.yourTurn;
    return line;
  }
  /** The first card's way out in words, beside Next: the close button is only a cross. */
  function skipButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'driver-popover-footer-btn guide-skip';
    button.textContent = copy.skip;
    button.addEventListener('click', finish);
    return button;
  }
  /** The first visit's last card's way on: the stops it left out, over the same reader's view. */
  function restButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'driver-popover-footer-btn guide-rest';
    button.textContent = copy.rest(restStops);
    button.addEventListener('click', () => {
      self.finish({ restore: false });
      drive(lang, options, reader, 'rest');
    });
    return button;
  }
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
        drive(value, options, inLanguage(reader, value), kind);
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
      clearTimeout(doneTimer);
      unpick();
      for (const type of TURNS) document.removeEventListener(type, turning, true);
      for (const type of settled) document.removeEventListener(type, placeCard, true);
      for (const type of INPUTS) document.removeEventListener(type, pressed, true);
      removeEventListener('resize', placeCard);
      reserve({ right: 0, bottom: 0 });
      leaveMri();
      lowerSheet();
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
