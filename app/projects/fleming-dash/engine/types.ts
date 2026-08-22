// Authoring format, input, and the event vocabulary.
//
// Two vocabularies live in this engine and they are deliberately separate:
//
//   LevelDoc / LevelObject  — what a level FILE contains. Grid units, compact,
//                             hand-editable, diff-friendly. Defined here.
//   World / GameObject      — what the engine RUNS. Class instances bucketed by
//                             column. Built once by world.ts from the above.
//
// Keeping them apart means the on-disk format can stay readable without the hot
// loop paying for it, and it means a new mechanic is added in two obvious
// places (a variant here, a class in objects/) rather than everywhere.

import type { GameMode } from "./modes/mode.ts";

export type { GameMode };
export type SimStatus = "running" | "dead" | "complete";

export type PadColor = "yellow" | "pink" | "red" | "blue";
export type RingColor = "yellow" | "pink" | "red" | "blue" | "green" | "black";
/** Index into SPEEDS. 0 is 0.5x, 1 is 1x, up to 4. */
export type SpeedIndex = 0 | 1 | 2 | 3 | 4;

// ── On-disk level format ────────────────────────────────────────────────────

/**
 * One authored object, in grid units.
 *
 * Mode portals keep their bare `t` names ("ship", "cube") so every level file
 * already written still parses unchanged — the imported Stereo Madness is 930
 * objects and reformatting it for a refactor would make its diff useless.
 */
export type LevelObject =
  /** w/h span so a 40-tile floor is one object, expanded at compile time. */
  | { t: "block"; x: number; y: number; w?: number; h?: number }
  /**
   * hw/hh are the lethal rect's size in PIXELS, straight from the game's own
   * object table (id 8 is 6x12 inside a 30x30 cell). Per-object rather than one
   * global constant, because a full spike, a half spike and a small thorn are
   * all differently forgiving.
   */
  /**
   * gw/gh are the object's size in GRID CELLS, defaulting to 1.
   *
   * Not cosmetic: the game's object table has half-size spikes (ids 103 and
   * 392 are 0.5 x 0.5). Assuming every hazard fills a whole cell drew those at
   * double size on a cell whose origin sits a quarter tile below the surface —
   * a spike both too big and sunk into the floor.
   */
  | {
      t: "spike";
      x: number;
      y: number;
      r?: 0 | 90 | 180 | 270;
      gw?: number;
      gh?: number;
      hw?: number;
      hh?: number;
    }
  // ── portals ──
  // gw/gh are the portal's real cell size. Every GD portal is 3 tiles tall, so
  // the authored y is already the cell BOTTOM — an object that shifts it again
  // lands a whole tile below where the level puts it.
  | { t: GameMode; x: number; y: number; gw?: number; gh?: number }
  | { t: "grav"; x: number; y: number; dir: "down" | "up"; gw?: number; gh?: number }
  | { t: "size"; x: number; y: number; s: "mini" | "normal" }
  | { t: "speed"; x: number; y: number; v: SpeedIndex }
  // ── boosts ──
  | { t: "pad"; x: number; y: number; c?: PadColor }
  | { t: "ring"; x: number; y: number; c?: RingColor }
  /** Purely visual: the dark notches cut into the ground and ceiling lines. */
  | { t: "pit"; x: number; y: number }
  /**
   * A secret coin. Three per official level, each on a route you have to go
   * out of your way for. Collectable, tracked per player, and completely
   * inert as far as physics is concerned.
   */
  | { t: "coin"; x: number; y: number }
  /** Per-column ground/ceiling overrides. Compiles to scalars, not rects. */
  /**
   * A colour change at an x position, straight from the level's own colour
   * triggers. Presentation only — it never touches physics.
   */
  | {
      t: "color";
      x: number;
      target: "bg" | "ground";
      rgb: [number, number, number];
      fade?: number;
    }
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
  /** Starting speed index. Legacy files use 1|2 meaning 1x|2x. */
  speed: SpeedIndex | 1 | 2;
  groundY: number;
  ceilingY: number | null;
  /** Starting colours, from the level header's kS29 / kS30. */
  bgColor?: [number, number, number];
  groundColor?: [number, number, number];
  objects: LevelObject[];
};

export type Rgb = [number, number, number];

// ── Runtime ─────────────────────────────────────────────────────────────────

export type InputState = {
  /** True while any input source is held. Cube auto-rejumps on hold, ship thrusts. */
  held: boolean;
  /**
   * The press EDGE, consumed on use and re-armed on the next fresh press.
   *
   * One click activates one ring: holding through two rings must fire only the
   * first. Also what makes ball and UFO taps discrete rather than continuous.
   */
  ringArmed: boolean;
};

/**
 * Side effects the sim reports rather than performs.
 *
 * stepSim never calls audio, particles, or React directly — it pushes here and
 * the caller drains it. That is what makes the whole engine runnable headlessly
 * under `node --test`, which is what makes replay tapes possible.
 */
export type SimEvent =
  | { type: "jump" }
  | { type: "land" }
  | { type: "pad"; vy: number; color: PadColor }
  | { type: "ring"; vy: number; color: RingColor }
  | { type: "portal"; mode: GameMode }
  | { type: "gravity"; sign: 1 | -1 }
  | { type: "size"; scale: number }
  | { type: "speed"; index: SpeedIndex }
  | { type: "color"; target: "bg" | "ground" }
  | { type: "coin"; index: number }
  | { type: "death"; x: number; y: number; cause: "hazard" | "wall" | "void" }
  | { type: "complete"; timeSec: number };

export type { Player } from "./player.ts";
