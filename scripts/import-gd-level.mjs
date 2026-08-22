// Convert an official Geometry Dash level into a Fleming Dash level file.
//
// Usage:
//   node scripts/import-gd-level.mjs <path-to-N.txt> <out.json> [--preview]
//
// SOURCE OF THE LEVEL
// The official RobTop levels ship as plain files inside the game bundle, one
// per level, numbered in play order:
//
//   .../Geometry Dash.app/Contents/Resources/levels/1.txt   (Stereo Madness)
//
// These are NOT CCLocalLevels.dat, which holds user-created levels and needs an
// extra XOR-11 pass. These need only URL-safe base64 -> gunzip, no decryption.
// Decoded, a level is a header (colour channels kS*, start mode kA2, speed kA4)
// then ';'-separated objects, each a flat key,value list where key 1 is the
// object id, 2 is x and 3 is y, in pixels on a 30px grid.
//
// SOURCE OF THE OBJECT SEMANTICS  <- the part that actually matters
// Knowing where an object sits is useless without knowing what it *is*, and
// that mapping is not in the level file. An earlier version of this script
// inferred it from the data and inferred wrong, in ways that made the level
// unplayable: id 5 was taken for a solid block when it is decoration (554 of
// them, filling every platform interior with phantom walls), and id 9 was taken
// for a spike when it is "pit_01" — the black notch drawn into the ground line
// (425 of them, rendered as triangles all over the level).
//
// The mapping now comes from RobTop's own object table, lifted from the
// official geometrydash.com web build, and lives beside the levels in
// gd-objects.json — 114 entries of { type, gw, gh, hx, hy, sub }. Nothing in
// this file is guessed any more.

import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TILE = 30;

/**
 * kA4 speed values map onto our SPEEDS table: the game writes 0 for 1x, then
 * 1 for 0.5x, 2 for 2x, 3 for 3x, 4 for 4x.
 */
const SPEED_INDEX = { 0: 1, 1: 0, 2: 2, 3: 3, 4: 4 };

/**
 * A flying section's height when the level puts nothing in it to measure.
 *
 * Only a fallback — a corridor with any geometry is measured from that
 * geometry. This is the game's standard ship border height and is the one
 * number here that is a convention rather than a reading.
 */
const EMPTY_SECTION_TILES = 10;
const HERE = dirname(fileURLToPath(import.meta.url));
const OBJECTS = JSON.parse(
  readFileSync(join(HERE, "../app/projects/fleming-dash/levels/gd-objects.json"), "utf8"),
);

function decode(path) {
  const raw = readFileSync(path, "utf8").trim();
  // Tolerate both alphabets: these files use the URL-safe one.
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  return gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
}

/** kS29 is the background colour, kS30 the ground colour, as "1_r_2_g_3_b_...". */
function parseHeaderColors(text) {
  const head = text.split(";")[0];
  const kv = {};
  const parts = head.split(",");
  for (let i = 0; i + 1 < parts.length; i += 2) kv[parts[i]] = parts[i + 1];
  const rgb = (raw, fallback) => {
    if (!raw) return fallback;
    const q = {};
    const bits = raw.split("_");
    for (let i = 0; i + 1 < bits.length; i += 2) q[bits[i]] = bits[i + 1];
    const [r, g, b] = [q["1"], q["2"], q["3"]].map(Number);
    return [r, g, b].every((n) => Number.isFinite(n)) ? [r, g, b] : fallback;
  };
  return {
    bg: rgb(kv.kS29, [40, 62, 255]),
    ground: rgb(kv.kS30, [0, 19, 200]),
    // kA2 is the starting gamemode and kA4 the starting speed. Both were
    // hardcoded to cube / 1x, which is right for the first two levels and
    // silently wrong for any level that opens in another mode or speed.
    startMode: START_MODES[kv.kA2] ?? "cube",
    speed: Number(kv.kA4) || 0,
  };
}

/** kA2 values, in the game's own order. */
const START_MODES = ["cube", "ship", "ball", "ufo", "wave", "robot", "spider"];

function parseObjects(text) {
  const [, ...chunks] = text.split(";");
  const out = [];
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const parts = chunk.split(",");
    const o = {};
    for (let i = 0; i + 1 < parts.length; i += 2) o[parts[i]] = parts[i + 1];
    if (!o["1"]) continue;
    out.push({
      id: Number(o["1"]),
      x: Number(o["2"] ?? 0),
      y: Number(o["3"] ?? 0),
      flipY: o["5"] === "1",
      rot: Number(o["6"] ?? 0),
      // Colour triggers carry their target colour in 7/8/9 and a fade in 10.
      rgb: [o["7"], o["8"], o["9"]].every((v) => v !== undefined)
        ? [Number(o["7"]), Number(o["8"]), Number(o["9"])]
        : null,
      fade: o["10"] !== undefined ? Number(o["10"]) : 0,
    });
  }
  return out;
}

/** GD positions objects by centre; our grid indexes by bottom-left cell. */
const toGrid = (px) => Math.round(px / TILE - 0.5);

/** Merge runs of same-height blocks on the same row into spans, for a readable file. */
function mergeBlockRuns(blocks) {
  const byRow = new Map();
  for (const b of blocks) {
    const key = `${b.y}|${b.h}`;
    if (!byRow.has(key)) byRow.set(key, []);
    byRow.get(key).push(b.x);
  }
  const out = [];
  for (const [key, xsRaw] of [...byRow.entries()].sort()) {
    const [y, h] = key.split("|").map(Number);
    const xs = [...new Set(xsRaw)].sort((a, b) => a - b);
    let start = xs[0];
    let prev = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      const x = xs[i];
      if (x === prev + 1) {
        prev = x;
        continue;
      }
      const w = prev - start + 1;
      const o = { t: "block", x: start, y };
      if (w > 1) o.w = w;
      if (h !== 1) o.h = h;
      out.push(o);
      start = x;
      prev = x;
    }
  }
  return out;
}

function convert(objects, meta) {
  const blocks = [];
  const rest = [];
  const skipped = new Map();
  const unknown = new Map();
  let maxX = 0;

  // The secret coins. The object table types them as `deco` because they carry
  // no collision, but they are the whole reason the alternate routes exist, so
  // they are matched by id before the type switch gets a say.
  const COIN_IDS = new Set([142, 1329]);

  for (const o of objects) {
    const def = OBJECTS[String(o.id)];
    if (!def) {
      unknown.set(o.id, (unknown.get(o.id) ?? 0) + 1);
      continue;
    }

    // A few table entries carry gw/gh of 0, meaning "use the sprite's own size".
    // One cell is the right approximation for everything we simulate.
    const gw = def.gw && def.gw > 0 ? def.gw : 1;
    const gh = def.gh && def.gh > 0 ? def.gh : 1;

    const x = toGrid(o.x);

    // GD stores an object's CENTRE, so the bottom of its cell is the centre
    // minus half its own height — not half a tile.
    //
    // Those are the same thing only for full-height objects. A plank (id 40,
    // gridH 0.5) sits just 7.5px above its base, so subtracting a whole half
    // tile dropped every slab 7.5px too low. Spikes resting on those slabs were
    // placed correctly and so appeared to float, detached from the thing they
    // are standing on. Deriving the offset from each object's real height fixes
    // the slab and the spike together.
    //
    // Rounded to quarter tiles: fine enough for half-height geometry, coarse
    // enough that the level file stays readable.
    const y = Math.round((o.y / TILE - gh / 2) * 4) / 4;
    if (x < 0 || y < -2) continue;
    maxX = Math.max(maxX, x);

    if (COIN_IDS.has(o.id)) {
      rest.push({ t: "coin", x, y });
      continue;
    }

    switch (def.type) {
      case "solid":
        blocks.push({ x, y, h: gh });
        break;

      case "hazard": {
        // Pits (ids 9, 61 — "pit_01", black:true) are the dark notches drawn
        // into the ground and ceiling lines, NOT spikes. The object table calls
        // them hazards and in the real game they mark a hole, but this engine
        // models the ground as continuous, so treating them as lethal would kill
        // the cube on stretches you plainly run straight across in the real
        // level (x 192-242, around 22-27%). They are carried through for
        // rendering and excluded from collision.
        if (def.frame && def.frame.startsWith("pit")) {
          rest.push({ t: "pit", x, y });
          break;
        }
        // GD encodes orientation as rotation plus a vertical flip; we only need
        // the four cardinal directions.
        let r = (((Math.round(o.rot / 90) * 90) % 360) + 360) % 360;
        if (o.flipY) r = (r + 180) % 360;
        const spike = { t: "spike", x, y };
        if (r) spike.r = r;
        // Half-size spikes exist (ids 103, 392). Carry the real cell size or
        // they render at double scale, sunk a quarter tile into the surface.
        if (gw !== 1) spike.gw = gw;
        if (gh !== 1) spike.gh = gh;
        // The lethal rect is the cell scaled by the table's own hitbox factors —
        // id 8 is 0.2 x 0.4, i.e. 6x12px inside a 30x30 cell. The gap between
        // the drawn triangle and the kill box is the game's forgiveness, and it
        // is a per-object property rather than one global guess.
        // hx/hy are the kill box as a FRACTION OF THE CELL, used literally:
        // id 8 is 0.2 x 0.4, so 6x12 inside a 30x30 spike.
        //
        // That gap between the small lethal rect and the big drawn triangle is
        // the whole forgiveness model — real spikes let you clip a surprising
        // amount of the visual and live. An earlier version read these as half
        // extents and doubled them, which made spikes brutal.
        if (def.hx) spike.hw = Math.max(2, Math.round(def.hx * TILE * gw));
        if (def.hy) spike.hh = Math.max(2, Math.round(def.hy * TILE * gh));
        rest.push(spike);
        break;
      }

      case "portal": {
        // gh is 3 for every portal, so `y` above is already the cell BOTTOM.
        // The object must not shift it again — doing so put every portal a
        // whole tile below where the level places it.
        const t = def.sub === "fly" ? "ship" : def.sub === "cube" ? "cube" : null;
        if (t) rest.push({ t, x, y, gw, gh });
        else if (def.sub === "normal" || def.sub === "flip") {
          rest.push({ t: "grav", x, y, dir: def.sub === "flip" ? "up" : "down", gw, gh });
        } else skipped.set(`portal:${def.sub}`, (skipped.get(`portal:${def.sub}`) ?? 0) + 1);
        break;
      }

      case "trigger": {
        // ids 29 and 30 are the background and ground colour triggers. Their
        // y is a trigger position, not geometry, so only x matters.
        const target = o.id === 29 ? "bg" : o.id === 30 ? "ground" : null;
        if (target && o.rgb) {
          rest.push({ t: "color", x, target, rgb: o.rgb, fade: o.fade || 0 });
        } else skipped.set(`trigger:${o.id}`, (skipped.get(`trigger:${o.id}`) ?? 0) + 1);
        break;
      }

      case "pad":
        rest.push({ t: "pad", x, y });
        break;

      case "ring":
        rest.push({ t: "ring", x, y });
        break;

      default:
        // deco, trigger, speed, startpos, gravpad, gravring — nothing the
        // simulation models yet. Counted rather than silently dropped, so the
        // gap between "imported" and "simulated" stays visible.
        skipped.set(def.type, (skipped.get(def.type) ?? 0) + 1);
    }
  }

  // A ship section with no ceiling plays as an empty void, so give each corridor
  // one. Derived from the portals rather than authored by hand.
  const portals = rest.filter((o) => o.t === "ship" || o.t === "cube").sort((a, b) => a.x - b.x);
  const zones = [];
  for (let i = 0; i < portals.length; i++) {
    if (portals[i].t !== "ship") continue;
    const next = portals.slice(i + 1).find((p) => p.t === "cube");
    const end = next ? next.x : maxX + 2;
    // The corridor roof, measured from what the level actually puts inside the
    // corridor rather than assumed.
    //
    // This was hardcoded to 10 because Stereo Madness's second ship section is
    // lined with ceiling pits at that height. That number is wrong for the
    // third section, which has geometry up to 14.5 and a secret coin at 12.5 —
    // a ceiling of 10 walled off the entire upper route and made the coin
    // literally unreachable, since the simulation clamps the ship at the
    // ceiling. Measuring per corridor fixes that here and in any level.
    const start = portals[i].x;
    const start_y = portals[i].y ?? 0;
    let roof = 0;
    for (const o of [...blocks, ...rest]) {
      // Colour triggers carry an x but no y — they are events, not geometry.
      // Including them turned the roof into NaN and the ceiling into null.
      if (typeof o.y !== "number" || o.x < start || o.x >= end) continue;
      roof = Math.max(roof, o.y + (typeof o.h === "number" ? o.h : 1));
    }
    // A tile of clearance above the tallest thing in the corridor. The floor of
    // 10 that used to sit here was the original hardcoded corridor height in
    // disguise: it silently overrode any corridor shorter than ten tiles.
    // Only a corridor with nothing in it to measure falls back to a convention,
    // and then it is anchored to the portal rather than to the ground.
    const ceilingY =
      roof > 0 ? Math.ceil(roof) + 1 : Math.ceil(start_y) + EMPTY_SECTION_TILES;
    zones.push({ t: "zone", x: start, w: Math.max(1, end - start), ceilingY });
  }

  const objectsOut = [
    ...mergeBlockRuns(blocks),
    ...rest.sort((a, b) => a.x - b.x),
    ...zones,
    { t: "end", x: maxX + 1 },
  ];

  return {
    doc: {
      format: 1,
      id: meta.id,
      // Bumped because the object mapping changed: old best percentages were
      // set against different geometry and are not comparable.
      rev: 3,
      name: meta.name,
      author: "RobTop Games",
      credit: "Level design by RobTop Games. Recreated for a portfolio project.",
      startMode: meta.colors.startMode,
      speed: SPEED_INDEX[meta.colors.speed] ?? 1,
      groundY: 0,
      ceilingY: null,
      bgColor: meta.colors.bg,
      groundColor: meta.colors.ground,
      objects: objectsOut,
    },
    stats: { blocks: blocks.length, rest: rest.length, maxX, skipped, unknown },
  };
}

/**
 * One object per line.
 *
 * JSON.stringify(doc, null, 2) explodes every object across five lines, which
 * makes a level diff unreadable — and the point of a text level format is that
 * you can see exactly what moved.
 */
function serialize(doc) {
  const { objects, ...head } = doc;
  const headLines = Object.entries(head).map(
    ([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`,
  );
  const objLines = objects.map((o) => `    ${JSON.stringify(o)}`);
  return `{\n${headLines.join(",\n")},\n  "objects": [\n${objLines.join(",\n")}\n  ]\n}\n`;
}

function preview(doc, cols = 76, rows = 10) {
  const grid = new Map();
  for (const o of doc.objects) {
    if (o.t === "block") {
      for (let i = 0; i < (o.w ?? 1); i++) {
        grid.set(`${o.x + i},${o.y}`, (o.h ?? 1) < 1 ? "=" : "#");
      }
    } else if (o.t === "spike") grid.set(`${o.x},${o.y}`, "^");
    else if (o.t === "ship") grid.set(`${o.x},${o.y}`, "S");
    else if (o.t === "cube") grid.set(`${o.x},${o.y}`, "C");
    else if (o.t === "pad") grid.set(`${o.x},${o.y}`, "P");
    else if (o.t === "ring") grid.set(`${o.x},${o.y}`, "o");
  }
  const lines = [];
  for (let y = rows - 1; y >= 0; y--) {
    let row = "";
    for (let x = 0; x < cols; x++) row += grid.get(`${x},${y}`) ?? ".";
    lines.push(`${String(y).padStart(2)} |${row}`);
  }
  return lines.join("\n");
}

// ── main ────────────────────────────────────────────────────────────────────

const [src, dest, ...flags] = process.argv.slice(2);
const idOf = (f) => (flags.find((a) => a.startsWith(`--${f}=`)) ?? "").split("=")[1];
if (!src || !dest || !idOf("id") || !idOf("name")) {
  console.error(
    "usage: node scripts/import-gd-level.mjs <N.txt> <out.json> --id=<slug> --name=<Title> [--preview]",
  );
  process.exit(1);
}

const text = decode(src);
const objects = parseObjects(text);
const { doc, stats } = convert(objects, {
  id: idOf("id"),
  name: idOf("name"),
  colors: parseHeaderColors(text),
});

writeFileSync(dest, serialize(doc));

const count = (t) => doc.objects.filter((o) => o.t === t).length;
console.log(`source objects   ${objects.length}`);
console.log(`  solids         ${stats.blocks} -> ${count("block")} spans`);
console.log(`  hazards        ${count("spike")}   (pits, non-lethal: ${count("pit")})`);
console.log(`  pads / rings   ${count("pad")} / ${count("ring")}`);
console.log(`  portals        ${count("ship") + count("cube") + count("grav")}`);
console.log(`  colour changes ${count("color")}`);
console.log(`  secret coins   ${count("coin")}`);
console.log(`  length         ${stats.maxX} tiles`);
console.log(`written          ${dest} (${doc.objects.length} objects)`);

if (stats.skipped.size) {
  console.log(`\nnot simulated (by table type):`);
  for (const [t, n] of [...stats.skipped].sort((a, b) => b[1] - a[1])) console.log(`  ${t}: ${n}`);
}
if (stats.unknown.size) {
  console.log(`\nids missing from the object table:`);
  for (const [id, n] of [...stats.unknown].sort((a, b) => b[1] - a[1])) console.log(`  id ${id} x${n}`);
}
if (process.argv.includes("--preview")) console.log(`\nfirst 76 columns:\n${preview(doc)}`);
