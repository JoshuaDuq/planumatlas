import type { CoordinateField } from '../../types/index.ts';
import { createField } from '../coordinates/field.ts';

/** Newton stops once the forward field carries a node's solution to within this of the node (mm). */
const TOLERANCE_MM = 1e-3;
const MAX_ITERATIONS = 20;

/**
 * A template's published field inverted: where a point of this brain lies in the template.
 *
 * The published field carries template millimetres to this brain's surface RAS, as a coordinate from a
 * paper is placed. Pulling an image across needs the other direction, so each node of a surface RAS grid
 * as fine as the field's is solved for the template point the field carries onto it. The overlay and a
 * placed coordinate then rest on the same registration.
 */
export interface InverseField {
  /** Nodes along each axis of the surface RAS grid; node (i, j, k) lies at origin + spacing·(i, j, k). */
  readonly shape: readonly [number, number, number];
  readonly origin: readonly [number, number, number];
  readonly spacing: number;
  /** Each node's template millimetres, x fastest, components interleaved; NaN where it has none. */
  readonly nodes: Float32Array;
  /**
   * Write the template millimetres of surface RAS point (x, y, z) into `out`; false, leaving `out`
   * unspecified, where a node it needs has none or the point is off the grid.
   */
  map(x: number, y: number, z: number, out: Float64Array): boolean;
}

function solve4(a: Float64Array, b: Float64Array, columns: number): Float64Array {
  // Gaussian elimination with partial pivoting on a 4×4 system with `columns` right-hand sides.
  const m = a.slice();
  const r = b.slice();
  for (let c = 0; c < 4; c++) {
    let pivot = c;
    for (let row = c + 1; row < 4; row++) {
      if (Math.abs(m[row * 4 + c]!) > Math.abs(m[pivot * 4 + c]!)) pivot = row;
    }
    if (m[pivot * 4 + c] === 0) throw new Error('The field’s nodes do not span three dimensions.');
    for (let k = 0; k < 4; k++)
      [m[c * 4 + k], m[pivot * 4 + k]] = [m[pivot * 4 + k]!, m[c * 4 + k]!];
    for (let k = 0; k < columns; k++) {
      [r[c * columns + k], r[pivot * columns + k]] = [r[pivot * columns + k]!, r[c * columns + k]!];
    }
    for (let row = 0; row < 4; row++) {
      if (row === c) continue;
      const factor = m[row * 4 + c]! / m[c * 4 + c]!;
      for (let k = 0; k < 4; k++) m[row * 4 + k]! -= factor * m[c * 4 + k]!;
      for (let k = 0; k < columns; k++) r[row * columns + k]! -= factor * r[c * columns + k]!;
    }
  }
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k < columns; k++) r[row * columns + k]! /= m[row * 4 + row]!;
  }
  return r;
}

/** Invert a template's published field (as `loadField` decodes it) onto a surface RAS grid. */
export function invertField(record: CoordinateField, data: Int16Array): InverseField {
  // createField checks the layout, the data length and the node affine.
  createField(record, data);
  const [nx, ny, nz] = record.shape as [number, number, number];
  const affine = record.node_to_template_mm;
  const scale = [affine[0]![0]!, affine[1]![1]!, affine[2]![2]!];
  const offset = [affine[0]![3]!, affine[1]![3]!, affine[2]![3]!];
  if (!(scale[0] === scale[1] && scale[1] === scale[2] && scale[0]! > 0)) {
    throw new Error('Inverting a coordinate field needs isotropic nodes.');
  }
  const spacing = scale[0]!;
  const { unit_mm: unit, outside } = record;

  // An affine fit of the field (surface RAS → template) seeds Newton, and the targets bound the grid.
  const normal = new Float64Array(16);
  const moment = new Float64Array(12);
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  const row = new Float64Array(4);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const at = 3 * (i + nx * (j + ny * k));
        if (data[at] === outside) continue;
        const p = [
          scale[0]! * i + offset[0]!,
          scale[1]! * j + offset[1]!,
          scale[2]! * k + offset[2]!,
        ];
        for (let axis = 0; axis < 3; axis++) {
          row[axis] = p[axis]! + data[at + axis]! * unit;
          low[axis] = Math.min(low[axis]!, row[axis]!);
          high[axis] = Math.max(high[axis]!, row[axis]!);
        }
        row[3] = 1;
        for (let a = 0; a < 4; a++) {
          for (let b = 0; b < 4; b++) normal[a * 4 + b]! += row[a]! * row[b]!;
          for (let c = 0; c < 3; c++) moment[a * 3 + c]! += row[a]! * p[c]!;
        }
      }
    }
  }
  if (!Number.isFinite(low[0])) throw new Error('The coordinate field carries no node.');
  const seed = solve4(normal, moment, 3);

  const origin = low.map((value) => Math.floor(value) - spacing) as [number, number, number];
  const shape = high.map(
    (value, axis) => Math.ceil((Math.ceil(value) + spacing - origin[axis]!) / spacing) + 1,
  ) as [number, number, number];
  const [mx, my, mz] = shape;
  const nodes = new Float32Array(mx * my * mz * 3).fill(Number.NaN);

  // The forward field at template point p: p + displacement, and its Jacobian, trilinear in the node.
  const forward = new Float64Array(3);
  const jacobian = new Float64Array(9);
  const evaluate = (p: Float64Array): boolean => {
    const u = (p[0]! - offset[0]!) / spacing;
    const v = (p[1]! - offset[1]!) / spacing;
    const w = (p[2]! - offset[2]!) / spacing;
    const bx = Math.floor(u),
      by = Math.floor(v),
      bz = Math.floor(w);
    if (bx < 0 || by < 0 || bz < 0 || bx > nx - 2 || by > ny - 2 || bz > nz - 2) return false;
    const fx = u - bx,
      fy = v - by,
      fz = w - bz;
    forward.fill(0);
    jacobian.fill(0);
    for (let corner = 0; corner < 8; corner++) {
      const i = (corner >> 2) & 1,
        j = (corner >> 1) & 1,
        k = corner & 1;
      const at = 3 * (bx + i + nx * (by + j + ny * (bz + k)));
      if (data[at] === outside) return false;
      const wx = i ? fx : 1 - fx,
        wy = j ? fy : 1 - fy,
        wz = k ? fz : 1 - fz;
      const dx = ((i ? 1 : -1) * wy * wz) / spacing,
        dy = ((j ? 1 : -1) * wx * wz) / spacing,
        dz = ((k ? 1 : -1) * wx * wy) / spacing;
      for (let c = 0; c < 3; c++) {
        const value = data[at + c]! * unit;
        forward[c]! += wx * wy * wz * value;
        jacobian[c * 3]! += value * dx;
        jacobian[c * 3 + 1]! += value * dy;
        jacobian[c * 3 + 2]! += value * dz;
      }
    }
    for (let c = 0; c < 3; c++) {
      forward[c]! += p[c]!;
      jacobian[c * 4]! += 1;
    }
    return true;
  };

  const p = new Float64Array(3);
  let unconverged = 0;
  for (let k = 0; k < mz; k++) {
    for (let j = 0; j < my; j++) {
      for (let i = 0; i < mx; i++) {
        const q = [origin[0] + spacing * i, origin[1] + spacing * j, origin[2] + spacing * k];
        for (let c = 0; c < 3; c++) {
          p[c] = q[0]! * seed[c]! + q[1]! * seed[3 + c]! + q[2]! * seed[6 + c]! + seed[9 + c]!;
        }
        // A node whose seed lies beyond the template's brain is beyond what the field carries.
        let solved = false;
        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          if (!evaluate(p)) break;
          const r0 = forward[0]! - q[0]!,
            r1 = forward[1]! - q[1]!,
            r2 = forward[2]! - q[2]!;
          if (Math.hypot(r0, r1, r2) < TOLERANCE_MM) {
            solved = true;
            break;
          }
          if (iteration === MAX_ITERATIONS - 1) {
            unconverged++;
            break;
          }
          const a = jacobian[0]!,
            b = jacobian[1]!,
            c = jacobian[2]!,
            d = jacobian[3]!,
            e = jacobian[4]!,
            f = jacobian[5]!,
            g = jacobian[6]!,
            h = jacobian[7]!,
            l = jacobian[8]!;
          const det = a * (e * l - f * h) - b * (d * l - f * g) + c * (d * h - e * g);
          p[0]! -= ((e * l - f * h) * r0 - (b * l - c * h) * r1 + (b * f - c * e) * r2) / det;
          p[1]! -= (-(d * l - f * g) * r0 + (a * l - c * g) * r1 - (a * f - c * d) * r2) / det;
          p[2]! -= ((d * h - e * g) * r0 - (a * h - b * g) * r1 + (a * e - b * d) * r2) / det;
        }
        if (solved) nodes.set(p, 3 * (i + mx * (j + my * k)));
      }
    }
  }
  if (unconverged) {
    throw new Error(`The coordinate field could not be inverted at ${unconverged} nodes.`);
  }

  return {
    shape,
    origin,
    spacing,
    nodes,
    map(x, y, z, out) {
      const u = (x - origin[0]) / spacing,
        v = (y - origin[1]) / spacing,
        w = (z - origin[2]) / spacing;
      const bx = Math.floor(u),
        by = Math.floor(v),
        bz = Math.floor(w);
      if (bx < 0 || by < 0 || bz < 0 || bx > mx - 2 || by > my - 2 || bz > mz - 2) return false;
      const fx = u - bx,
        fy = v - by,
        fz = w - bz;
      out[0] = out[1] = out[2] = 0;
      for (let corner = 0; corner < 8; corner++) {
        const i = (corner >> 2) & 1,
          j = (corner >> 1) & 1,
          k = corner & 1;
        const at = 3 * (bx + i + mx * (by + j + my * (bz + k)));
        // A NaN corner leaves NaN in `out`, whatever its weight.
        const weight = (i ? fx : 1 - fx) * (j ? fy : 1 - fy) * (k ? fz : 1 - fz);
        out[0] += weight * nodes[at]!;
        out[1] += weight * nodes[at + 1]!;
        out[2] += weight * nodes[at + 2]!;
      }
      return !Number.isNaN(out[0] + out[1] + out[2]);
    },
  };
}
