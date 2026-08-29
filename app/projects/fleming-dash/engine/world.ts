// The compiled level: object instances, bucketed by column.
//
// The authored file optimises for being readable and diffable; this optimises
// for lookup. Each object is registered in every column its DRAWN footprint
// touches, so the simulation never scans — it reads three or four columns and
// finds a handful of instances.
//
// Ground and ceiling are scalars per column rather than rects: one comparison,
// exact at any level length, and a ship corridor costs nothing at runtime.

import { HAZARD_SEAT_SNAP, SPEEDS, TILE } from "./constants.ts";
import { columnSpan, type Aabb } from "./core/aabb.ts";
import { buildObject } from "./objects/registry.ts";
import { Coin } from "./objects/coin.ts";
import {
  DecorObject,
  GameObject,
  HazardObject,
  SolidObject,
  TriggerObject,
} from "./objects/object.ts";
import type { GameMode } from "./modes/mode.ts";
import type { LevelDoc, LevelObject, Rgb, SpeedIndex } from "./types.ts";

export type Column = {
  /** World y of this column's walkable surface. */
  groundY: number;
  /** World y of the ceiling underside, or Infinity for open sky. */
  ceilingY: number;
  solids: SolidObject[];
  hazards: HazardObject[];
  triggers: TriggerObject[];
  /** Visual only — the renderer draws these, the simulation never sees them. */
  decor: DecorObject[];
};

export class World {
  readonly id: string;
  readonly rev: number;
  readonly name: string;
  readonly startMode: GameMode;
  readonly startSpeed: SpeedIndex;
  readonly columns: Column[];
  readonly lengthPx: number;
  readonly spawn: { x: number; y: number };
  /** Starting colours from the level header; the Palette resets to these. */
  readonly bgColor: Rgb;
  readonly groundColor: Rgb;
  /** Number of TriggerObjects, sizing the per-trigger edge-tracking array. */
  readonly triggerCount: number;
  /** How many secret coins this level has. Three in every official level. */
  readonly coinCount: number;
  /** Highest solid surface in the level, in px. The camera clamps to it. */
  readonly maxHeight: number;

  constructor(doc: LevelDoc) {
    const end = doc.objects.find(
      (o): o is Extract<LevelObject, { t: "end" }> => o.t === "end",
    );
    if (!end) throw new Error(`Level "${doc.id}" has no end marker.`);

    const width = end.x + 2; // one spare column past the finish line
    const baseGround = doc.groundY * TILE;
    const baseCeiling = doc.ceilingY === null ? Infinity : doc.ceilingY * TILE;

    this.columns = Array.from({ length: width }, () => ({
      groundY: baseGround,
      ceilingY: baseCeiling,
      solids: [],
      hazards: [],
      triggers: [],
      decor: [],
    }));

    // Zones first: they set the ground and ceiling everything else sits on.
    for (const o of doc.objects) {
      if (o.t !== "zone") continue;
      const hi = Math.min(width - 1, o.x + o.w - 1);
      for (let gx = Math.max(0, o.x); gx <= hi; gx++) {
        const col = this.columns[gx];
        if (!col) continue;
        if (o.groundY !== undefined) col.groundY = o.groundY * TILE;
        if (o.ceilingY !== undefined) col.ceilingY = o.ceilingY * TILE;
      }
    }

    let triggerCount = 0;
    let maxHeight = baseGround;

    for (const authored of doc.objects) {
      const obj = buildObject(authored);
      if (!obj) continue;
      if (obj instanceof TriggerObject) obj.id = triggerCount++;
      if (obj instanceof SolidObject) {
        maxHeight = Math.max(maxHeight, obj.box.y + obj.box.h);
      }
      this.register(obj);
    }

    this.id = doc.id;
    this.rev = doc.rev;
    this.name = doc.name;
    this.startMode = doc.startMode;
    this.startSpeed = normalizeSpeed(doc.speed);
    this.triggerCount = triggerCount;
    this.lengthPx = end.x * TILE;
    this.maxHeight = maxHeight;
    this.coinCount = this.numberCoins();
    this.bgColor = doc.bgColor ?? [40, 62, 255];
    this.groundColor = doc.groundColor ?? [0, 19, 200];
    this.spawn = { x: 0, y: (this.columns[0]?.groundY ?? 0) + TILE / 2 };
    this.seatHazards();
  }

  /**
   * Sit every hazard flush on the surface it was authored against.
   *
   * Level files are produced by an importer that quantises positions to quarter
   * tiles, so a spike meant to rest on the floor can land a few pixels under
   * it — and a spike sunk into the ground is nonsense the player reads
   * instantly. A hazard within HAZARD_SEAT_SNAP of a surface is meant to be ON
   * that surface, so it is moved there.
   *
   * Deliberately a tolerance and not a blanket "drop everything to the floor":
   * hazards genuinely placed in mid-air, and ceiling-mounted ones, are further
   * than the tolerance from any surface and are left exactly where they are.
   *
   * This runs at compile time for every level, so it is not a repair of one
   * file — any level, hand-written or imported, gets seated hazards.
   */
  private seatHazards(): void {
    const seen = new Set<HazardObject>();
    for (let gx = 0; gx < this.columns.length; gx++) {
      const col = this.columns[gx];
      if (!col) continue;
      for (const hazard of col.hazards) {
        if (seen.has(hazard)) continue;
        seen.add(hazard);

        const base = hazard.cell.y;
        let surface = col.groundY;
        let best = Math.abs(base - surface);
        for (const solid of col.solids) {
          for (const edge of [solid.box.y + solid.box.h, solid.box.y]) {
            const d = Math.abs(base - edge);
            if (d < best) {
              best = d;
              surface = edge;
            }
          }
        }
        if (best > 1e-6 && best <= HAZARD_SEAT_SNAP) hazard.seatAt(surface);
      }
    }
  }

  /**
   * Give each coin its index, left to right.
   *
   * Done here rather than at build time because a coin is registered in several
   * columns and must get ONE index; ordering by x means "the second coin" means
   * the same thing to the level, the save file and the player.
   */
  private numberCoins(): number {
    const seen = new Set<Coin>();
    const coins: Coin[] = [];
    for (const col of this.columns) {
      for (const trigger of col.triggers) {
        if (trigger instanceof Coin && !seen.has(trigger)) {
          seen.add(trigger);
          coins.push(trigger);
        }
      }
    }
    coins.sort((a, b) => a.cell.x - b.cell.x);
    coins.forEach((coin, i) => (coin.index = i));
    return coins.length;
  }

  /** File the object in every column its drawn footprint touches. */
  private register(obj: GameObject): void {
    const [lo, hi] = columnSpan(obj.cell, TILE, this.columns.length - 1);
    for (let gx = lo; gx <= hi; gx++) {
      const col = this.columns[gx];
      if (!col) continue;
      if (obj instanceof SolidObject) col.solids.push(obj);
      else if (obj instanceof HazardObject) col.hazards.push(obj);
      else if (obj instanceof TriggerObject) col.triggers.push(obj);
      else if (obj instanceof DecorObject) col.decor.push(obj);
    }
  }

  /**
   * The level's declared play borders at this x, in world px.
   *
   * THIS IS THE ONLY THING THE CAMERA IS ALLOWED TO CLAMP AGAINST, and it is
   * deliberately not derived from the objects in the level. An earlier version
   * computed a "skyline" from nearby block heights, which meant passing a tall
   * structure moved the view even though the player had not moved — the camera
   * reacted to scenery instead of to the icon. That was wrong.
   *
   * A border is something the level DECLARES: the ground, and a zone ceiling
   * where one exists (Geometry Dash's ship gamemode has exactly these top and
   * bottom borders by default). Blocks are scenery and never affect the view.
   *
   * `ceiling` is Infinity in open sections, where there is no border at all and
   * the camera simply follows the player.
   */
  playBounds(x: number): { floor: number; ceiling: number } {
    const col = this.columnAt(x) ?? this.columns[0];
    return { floor: col?.groundY ?? 0, ceiling: col?.ceilingY ?? Infinity };
  }

  columnAt(x: number): Column | undefined {
    return this.columns[Math.floor(x / TILE)];
  }

  groundAt(x: number): number {
    return this.columnAt(x)?.groundY ?? 0;
  }

  ceilingAt(x: number): number {
    return this.columnAt(x)?.ceilingY ?? Infinity;
  }

  /** Column range a box overlaps, padded by one on each side. */
  span(box: Aabb): [number, number] {
    const lo = Math.max(0, Math.floor(box.x / TILE) - 1);
    const hi = Math.min(this.columns.length - 1, Math.floor((box.x + box.w) / TILE) + 1);
    return [lo, hi];
  }
}

/** Legacy files wrote `speed: 1 | 2` meaning 1x | 2x, which are indices 1 and 2. */
function normalizeSpeed(v: number): SpeedIndex {
  const i = Math.round(v);
  return (i >= 0 && i < SPEEDS.length ? i : 1) as SpeedIndex;
}

export function compileLevel(doc: LevelDoc): World {
  return new World(doc);
}
