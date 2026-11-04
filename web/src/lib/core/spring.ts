/**
 * A critically damped spring (damping ratio 1: no overshoot from rest), shared by the camera and
 * the phone sheet so a reframe and the sheet that caused it arrive as one object.
 *
 * Progress runs from 0 to 1. `response` is Apple's: the period of the undamped oscillation, in
 * seconds. `velocity` is the starting rate in whole moves per second, so a gesture's velocity is
 * divided by the distance left to go. Pure: no DOM, no timers.
 */
export interface SpringState {
  value: number;
  velocity: number;
}

/** A camera view change: 95 % of the way in about 0.29 s, whatever the turn. */
export const CAMERA_RESPONSE = 0.38;
/** The phone sheet settling on a detent, and the image's offset that rides it. */
export const SHEET_RESPONSE = 0.3;

export const angularFrequency = (response: number) => (2 * Math.PI) / response;

export function springAt(seconds: number, response: number, velocity = 0): SpringState {
  if (!(response > 0)) throw new Error(`A spring's response must be positive, not ${response}.`);
  const omega = angularFrequency(response);
  const t = Math.max(0, seconds);
  const decay = Math.exp(-omega * t);
  return {
    value: 1 - (1 + (omega - velocity) * t) * decay,
    velocity: (velocity - omega * (velocity - omega) * t) * decay,
  };
}

/**
 * The fastest start that still never passes the target: above ω a thrown move overshoots once.
 * Clamped below at 0, so a throw away from the target starts from rest instead of backing up.
 */
export const noOvershoot = (velocity: number, response: number) =>
  Math.min(Math.max(velocity, 0), angularFrequency(response));

/** Whether a move of `distance` units has come within `tolerance` units of rest. */
export function springSettled(
  { value, velocity }: SpringState,
  distance: number,
  tolerance: number,
): boolean {
  return (
    Math.abs(1 - value) * distance <= tolerance && Math.abs(velocity) * distance <= tolerance * 10
  );
}
