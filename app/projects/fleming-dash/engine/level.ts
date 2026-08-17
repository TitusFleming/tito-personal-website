// Turning an authored level file into something the hot loop can query cheaply.
//
// The on-disk format optimises for being readable and diffable: grid units,
// spans, a handful of object types. The compiled form optimises for lookup:
// pixels, indexed by column. compileLevel is the one place that knows both.

import {
  PAD_YELLOW_VY,
  RING_YELLOW_VY,
  SPIKE_BOX,
  TILE,
} from "./constants.ts";
import type {
  Aabb,
  Column,
  CompiledLevel,
  LevelDoc,
  LevelObject,
  Trigger,
} from "./types.ts";

/** A spike's lethal rect within its cell, for each of the four orientations. */
function spikeRect(gx: number, gy: number, r: 0 | 90 | 180 | 270): Aabb {
  const x0 = gx * TILE;
  const y0 = gy * TILE;
  const { dx, dy, w, h } = SPIKE_BOX;

  switch (r) {
    case 180: // pointing down, e.g. hanging from a ceiling
      return { x: x0 + dx, y: y0 + TILE - dy - h, w, h };
    case 90: // pointing right
      return { x: x0 + dy, y: y0 + dx, w: h, h: w };
    case 270: // pointing left
      return { x: x0 + TILE - dy - h, y: y0 + dx, w: h, h: w };
    default:
      return { x: x0 + dx, y: y0 + dy, w, h };
  }
}

function emptyColumn(groundY: number, ceilingY: number): Column {
  return { groundY, ceilingY, solids: [], hazards: [], triggers: [] };
}

/** Register a rect in every column it touches, so lookup never has to scan. */
function spread(columns: Column[], box: Aabb, add: (col: Column) => void): void {
  const lo = Math.max(0, Math.floor(box.x / TILE));
  const hi = Math.min(columns.length - 1, Math.floor((box.x + box.w - 0.001) / TILE));
  for (let gx = lo; gx <= hi; gx++) {
    const col = columns[gx];
    if (col) add(col);
  }
}

export function compileLevel(doc: LevelDoc): CompiledLevel {
  const end = doc.objects.find((o): o is Extract<LevelObject, { t: "end" }> => o.t === "end");
  if (!end) throw new Error(`Level "${doc.id}" has no end marker.`);

  const width = end.x + 2; // one spare column past the finish line
  const baseGround = doc.groundY * TILE;
  const baseCeiling = doc.ceilingY === null ? Infinity : doc.ceilingY * TILE;

  const columns: Column[] = Array.from({ length: width }, () =>
    emptyColumn(baseGround, baseCeiling),
  );

  // Zones first: they set the ground and ceiling the rest of the objects sit on.
  for (const o of doc.objects) {
    if (o.t !== "zone") continue;
    const hi = Math.min(width - 1, o.x + o.w - 1);
    for (let gx = Math.max(0, o.x); gx <= hi; gx++) {
      const col = columns[gx];
      if (!col) continue;
      if (o.groundY !== undefined) col.groundY = o.groundY * TILE;
      if (o.ceilingY !== undefined) col.ceilingY = o.ceilingY * TILE;
    }
  }

  let triggerCount = 0;
  const makeTrigger = (kind: Trigger["kind"], box: Aabb, vy: number): Trigger => ({
    id: triggerCount++,
    kind,
    box,
    vy,
  });

  for (const o of doc.objects) {
    switch (o.t) {
      case "block": {
        // Spans expand here, so a 40-tile floor is one authored object.
        const box: Aabb = {
          x: o.x * TILE,
          y: o.y * TILE,
          w: (o.w ?? 1) * TILE,
          h: (o.h ?? 1) * TILE,
        };
        spread(columns, box, (col) => col.solids.push(box));
        break;
      }
      case "spike": {
        const box = spikeRect(o.x, o.y, o.r ?? 0);
        spread(columns, box, (col) => col.hazards.push(box));
        break;
      }
      case "ship":
      case "cube": {
        // Portals are one tile wide and three tall, so you cannot miss one.
        const box: Aabb = { x: o.x * TILE, y: (o.y - 1) * TILE, w: TILE, h: TILE * 3 };
        const trig = makeTrigger(o.t, box, 0);
        spread(columns, box, (col) => col.triggers.push(trig));
        break;
      }
      case "pad": {
        // Sits flat on the cell floor — you hit it by walking or falling over it.
        const box: Aabb = { x: o.x * TILE, y: o.y * TILE, w: TILE, h: TILE * 0.35 };
        const trig = makeTrigger("pad", box, PAD_YELLOW_VY);
        spread(columns, box, (col) => col.triggers.push(trig));
        break;
      }
      case "ring": {
        const box: Aabb = { x: o.x * TILE, y: o.y * TILE, w: TILE, h: TILE };
        const trig = makeTrigger("ring", box, RING_YELLOW_VY);
        spread(columns, box, (col) => col.triggers.push(trig));
        break;
      }
      default:
        break; // zone and end are handled outside the loop
    }
  }

  const spawnCol = columns[0];
  return {
    id: doc.id,
    rev: doc.rev,
    name: doc.name,
    startMode: doc.startMode,
    speed: doc.speed === 2 ? 387.42 : 311.58,
    columns,
    triggerCount,
    lengthPx: end.x * TILE,
    spawn: { x: 0, y: (spawnCol ? spawnCol.groundY : 0) + TILE / 2 },
  };
}

export type LevelWarning = { severity: "error" | "warn"; message: string };

/**
 * Cheap structural checks. Kept pure and separate from compileLevel so the
 * importer can report on a level without building one.
 */
export function validateLevel(doc: LevelDoc): LevelWarning[] {
  const out: LevelWarning[] = [];
  const end = doc.objects.find((o) => o.t === "end");

  if (!end) out.push({ severity: "error", message: "No end marker." });
  if (doc.objects.some((o) => "x" in o && o.x < 0)) {
    out.push({ severity: "error", message: "Objects at negative x." });
  }

  // A ship section with no ceiling is unbounded, which plays as an empty void.
  const portals = doc.objects
    .filter((o) => o.t === "ship" || o.t === "cube")
    .sort((a, b) => ("x" in a ? a.x : 0) - ("x" in b ? b.x : 0));
  let mode = doc.startMode;
  for (const p of portals) {
    if (p.t === mode) {
      out.push({ severity: "warn", message: `Redundant ${p.t} portal at x=${"x" in p ? p.x : "?"}.` });
    }
    if (p.t === "ship" || p.t === "cube") mode = p.t;
  }
  if (mode === "ship" && doc.ceilingY === null) {
    out.push({ severity: "warn", message: "Level ends in ship mode with no ceiling." });
  }

  return out;
}
