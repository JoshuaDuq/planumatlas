import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Orbiting, panning and zooming from the keyboard.
 *
 * The canvas is focusable and tells a screen reader it can be rotated and
 * zoomed, which until now was only true with a pointer. These are the same
 * gestures expressed as key presses, in the same directions: a right arrow
 * turns the model the way dragging right turns it, and with Shift moves it
 * right as a right-drag does, so the two agree. All go through the controls'
 * own orbit, so they share its frame, its poles and the surface the camera
 * stays outside.
 */

/** Five degrees: fine enough to aim, coarse enough to cross a hemisphere. */
export const ORBIT_STEP = Math.PI / 36;

/**
 * As far as the drag that turns the model one step moves it, as a share of the canvas height:
 * OrbitControls turns a drag by a full turn per canvas height and pans the model with the pointer,
 * so 1/72. Thirty-six presses cross a hemisphere, or half the view.
 */
export const PAN_STEP = ORBIT_STEP / (2 * Math.PI);

/** One step of zoom, matching the wheel's proportional feel. */
const DOLLY_STEP = 1.1;

export interface OrbitDelta {
  azimuth?: number;
  polar?: number;
}

/** Arrow directions, as changes to the orbit's azimuth and polar angle. */
export const ORBIT_KEYS: Readonly<
  Record<'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown', OrbitDelta>
> = {
  ArrowLeft: { azimuth: ORBIT_STEP },
  ArrowRight: { azimuth: -ORBIT_STEP },
  ArrowUp: { polar: ORBIT_STEP },
  ArrowDown: { polar: -ORBIT_STEP },
};

export interface PanDelta {
  /** Shares of the canvas height the model moves right, and up, on screen. */
  right?: number;
  up?: number;
}

/** Arrow directions with Shift: the model moves the way the arrow points. */
export const PAN_KEYS: Readonly<
  Record<'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown', PanDelta>
> = {
  ArrowLeft: { right: -PAN_STEP },
  ArrowRight: { right: PAN_STEP },
  ArrowUp: { up: PAN_STEP },
  ArrowDown: { up: -PAN_STEP },
};

/** Factors on the camera's distance. `+` and `=` share a key on most layouts, so both zoom in. */
export const DOLLY_KEYS: Readonly<Record<'+' | '=' | '-', number>> = {
  '+': 1 / DOLLY_STEP,
  '=': 1 / DOLLY_STEP,
  '-': DOLLY_STEP,
};

/** One arrow press, applied at once: the controls are undamped, and key presses do not animate. */
export function turnFromKeyboard(
  controls: Pick<OrbitControls, 'rotateLeft' | 'rotateUp'>,
  { azimuth = 0, polar = 0 }: OrbitDelta,
): void {
  // OrbitControls subtracts what it is given from both angles.
  if (azimuth) controls.rotateLeft(-azimuth);
  if (polar) controls.rotateUp(-polar);
}

/** One Shift+arrow press, applied at once as a turn is. */
export function panFromKeyboard(
  controls: Pick<OrbitControls, 'pan' | 'domElement'>,
  { right = 0, up = 0 }: PanDelta,
): void {
  // OrbitControls pans by a pointer's pixels, right and down positive, and the model follows the pointer.
  const height = controls.domElement!.clientHeight;
  controls.pan(right * height, -up * height);
}
