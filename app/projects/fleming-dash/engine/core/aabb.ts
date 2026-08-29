// Axis-aligned bounding boxes, as values.
//
// Every rect in the game — player bodies, kill rects, trigger volumes, drawn
// cells — is one of these, and they are produced by exactly one place
// (hitbox.ts) rather than being assembled ad hoc at each call site. That is the
// property that makes a new object type or a new player size a data change
// rather than a hunt through collision code.

export type Aabb = {
  /** Left edge, world px. */
  readonly x: number;
  /** BOTTOM edge, world px. World space is y-up; the renderer flips once. */
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export function aabb(x: number, y: number, w: number, h: number): Aabb {
  return { x, y, w, h };
}

export function overlaps(a: Aabb, b: Aabb): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export const left = (a: Aabb) => a.x;
export const right = (a: Aabb) => a.x + a.w;
export const bottom = (a: Aabb) => a.y;
export const top = (a: Aabb) => a.y + a.h;
export const centerX = (a: Aabb) => a.x + a.w / 2;
export const centerY = (a: Aabb) => a.y + a.h / 2;

/**
 * Penetration depth on each axis, for a pair already known to overlap.
 *
 * The shallower axis is the one the mover actually came from, which is how a
 * landing is told apart from a wall hit. Returns zeroes when disjoint.
 */
export function overlapDepth(a: Aabb, b: Aabb): { x: number; y: number } {
  if (!overlaps(a, b)) return { x: 0, y: 0 };
  return {
    x: Math.min(right(a), right(b)) - Math.max(left(a), left(b)),
    y: Math.min(top(a), top(b)) - Math.max(bottom(a), bottom(b)),
  };
}

/** Grid column range a box touches, clamped to [0, maxCol]. */
export function columnSpan(a: Aabb, tile: number, maxCol: number): [number, number] {
  const lo = Math.max(0, Math.floor(a.x / tile));
  const hi = Math.min(maxCol, Math.floor((a.x + a.w - 0.001) / tile));
  return [lo, hi];
}
