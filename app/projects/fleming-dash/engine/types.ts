// Shared types for the Fleming Dash engine.
//
// Two vocabularies live here and they are deliberately separate:
//
//   LevelDoc / LevelObject  — what a level file contains. Grid units, compact,
//                             hand-editable, diff-friendly.
//   CompiledLevel / Column  — what the engine actually runs. Pixels, indexed by
//                             column for O(1) lookup. Built once at load.
//
// Keeping them apart means the on-disk format can stay readable without the hot
// loop paying for it.

export type GameMode = "cube" | "ship";
export type SimStatus = "running" | "dead" | "complete";

// ── On-disk level format ────────────────────────────────────────────────────

/**
 * One authored object, in grid units.
 *
 * `block` takes an optional w/h span so a 40-tile floor is one object rather
 * than 40 — expanded at compile time. `zone` is how ground and ceiling height
 * vary across the level; it compiles to per-column scalars, not to rects, so a
 * ship corridor costs nothing at runtime.
 */
export type LevelObject =
  | { t: "block"; x: number; y: number; w?: number; h?: number }
  | { t: "spike"; x: number; y: number; r?: 0 | 90 | 180 | 270 }
  | { t: "ship"; x: number; y: number }
  | { t: "cube"; x: number; y: number }
  | { t: "pad"; x: number; y: number; c?: "yellow" }
  | { t: "ring"; x: number; y: number; c?: "yellow" }
  | { t: "zone"; x: number; w: number; groundY?: number; ceilingY?: number }
  | { t: "end"; x: number };

export type LevelDoc = {
  format: 1;
  id: string;
  /**
   * Bumped whenever object positions change. Saved progress records the rev it
   * was set on, so an edited level shows "level updated" instead of silently
   * comparing percentages against different geometry.
   */
  rev: number;
  name: string;
  author: string;
  credit?: string;
  startMode: GameMode;
  speed: 1 | 2;
  groundY: number;
  ceilingY: number | null;
  objects: LevelObject[];
};

// ── Compiled level ──────────────────────────────────────────────────────────

export type Aabb = { x: number; y: number; w: number; h: number };

export type TriggerKind = "ship" | "cube" | "pad" | "ring";

export type Trigger = {
  /** Dense index into SimState.triggerTouch. */
  id: number;
  kind: TriggerKind;
  box: Aabb;
  /** Launch velocity, for pads and rings. */
  vy: number;
};

export type Column = {
  /** World y of this column's walkable surface. A scalar, not a rect — one comparison, exact at any length. */
  groundY: number;
  /** World y of the ceiling underside, or Infinity for open sky. */
  ceilingY: number;
  solids: Aabb[];
  hazards: Aabb[];
  triggers: Trigger[];
};

export type CompiledLevel = {
  id: string;
  rev: number;
  name: string;
  startMode: GameMode;
  /** px/s. */
  speed: number;
  /** Indexed by grid x. */
  columns: Column[];
  triggerCount: number;
  lengthPx: number;
  spawn: { x: number; y: number };
};

// ── Runtime ─────────────────────────────────────────────────────────────────

export type InputState = {
  /** True while any input source is held. Cube auto-rejumps on hold, ship thrusts on hold. */
  held: boolean;
  /**
   * One click activates one ring. Holding through two rings fires only the
   * first, so this is consumed on use and re-armed on the next press.
   */
  ringArmed: boolean;
};

export type SimState = {
  status: SimStatus;
  /** Seconds into this attempt. */
  t: number;
  mode: GameMode;
  /** World px, player CENTER. Boxes are derived from mode, never stored. */
  x: number;
  y: number;
  vy: number;
  onGround: boolean;
  rot: number;
  /**
   * 1 = normal, -1 = inverted. Nothing sets this yet, but every branch that
   * touches gravity already multiplies by it — retrofitting gravity portals
   * later would otherwise mean revisiting all of them.
   */
  gravitySign: 1 | -1;
  attempt: number;
  /** Furthest x reached this attempt, for the progress percentage. */
  maxX: number;
  /** Per-trigger "was overlapping last step" bit. A Uint8Array rather than a Set: no allocation at 240 Hz. */
  triggerTouch: Uint8Array;
  deathTimer: number;
};

/**
 * Side effects the sim reports rather than performs.
 *
 * stepSim never calls audio, particles, or React directly — it pushes here and
 * the caller drains it. That is what makes the whole engine runnable headlessly
 * under `node --test`.
 */
export type SimEvent =
  | { type: "jump" }
  | { type: "land" }
  | { type: "pad"; vy: number }
  | { type: "ring"; vy: number }
  | { type: "portal"; mode: GameMode }
  | { type: "death"; x: number; y: number; cause: "hazard" | "wall" | "void" }
  | { type: "complete"; timeSec: number };
