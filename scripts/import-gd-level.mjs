// Convert an official Geometry Dash level into a Fleming Dash level file.
//
// Usage:
//   node scripts/import-gd-level.mjs <path-to-N.txt> <out.json> [--preview]
//
// Where the source comes from: the official RobTop levels ship as plain files
// inside the game bundle, one per level, numbered in play order —
//
//   .../Geometry Dash.app/Contents/Resources/levels/1.txt   (Stereo Madness)
//
// These are NOT CCLocalLevels.dat, which holds user-created levels and needs an
// extra XOR-11 pass. These need only URL-safe base64 -> gunzip, no decryption.
//
// Decoded, a level is a header (color channels kS*, start mode kA2, speed kA4)
// then ';'-separated objects, each a flat key,value list where key 1 is the
// object id, 2 is x and 3 is y, both in pixels on a 30px grid.
//
// Run this against your own copy of the game. It reads; it never writes back.

import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const TILE = 30;

// ── Object id mapping ───────────────────────────────────────────────────────
//
// A level uses a few dozen object ids, but the overwhelming majority are
// decoration. Stereo Madness has 2,291 objects across 31 ids, and only a
// handful of those ids affect whether you live or die — so this maps the ones
// that matter and deliberately drops the rest, which is what makes importing a
// full RobTop level tractable at all.
//
// The mapping was verified empirically rather than trusted: rendering the first
// 75 columns as ASCII reproduces Stereo Madness's known opening (a lone spike,
// then a pair, then a stair of blocks), which pins ids 1, 8 and 39. Re-run with
// --preview after changing anything here.
const SOLID_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 40, 41]);
const SPIKE_IDS = new Set([8, 39]);
const SHORT_SPIKE_IDS = new Set([39]);
const CUBE_PORTAL_IDS = new Set([12]);
const SHIP_PORTAL_IDS = new Set([13]);
const PAD_IDS = new Set([35]);
const RING_IDS = new Set([36]);

/** Ids known to be purely visual. Listed explicitly so an unknown id is loud. */
const DECORATION_IDS = new Set([
  9, 15, 16, 17, 18, 19, 20, 21, 22, 23, 27, 29, 30, 54, 62, 65, 103, 142,
]);

function decode(path) {
  const raw = readFileSync(path, "utf8").trim();
  // Tolerate both alphabets: these files use the URL-safe one.
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  return gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
}

function parseObjects(text) {
  const [, ...chunks] = text.split(";");
  const objects = [];

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const parts = chunk.split(",");
    const o = {};
    for (let i = 0; i + 1 < parts.length; i += 2) o[parts[i]] = parts[i + 1];
    if (!o["1"]) continue;

    objects.push({
      id: Number(o["1"]),
      x: Number(o["2"] ?? 0),
      y: Number(o["3"] ?? 0),
      flipY: o["5"] === "1",
      rot: Number(o["6"] ?? 0),
    });
  }
  return objects;
}

/** GD positions objects by centre; our grid indexes by bottom-left cell. */
const toGrid = (px) => Math.round(px / TILE - 0.5);

/** Merge runs of single blocks on the same row into spans, so the file stays readable. */
function mergeBlockRuns(blocks) {
  const byRow = new Map();
  for (const b of blocks) {
    if (!byRow.has(b.y)) byRow.set(b.y, []);
    byRow.get(b.y).push(b.x);
  }

  const out = [];
  for (const [y, xsRaw] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
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
      out.push(w > 1 ? { t: "block", x: start, y, w } : { t: "block", x: start, y });
      start = x;
      prev = x;
    }
  }
  return out;
}

function convert(objects, meta) {
  const blocks = [];
  const rest = [];
  const unknown = new Map();
  let maxX = 0;

  for (const o of objects) {
    const x = toGrid(o.x);
    const y = toGrid(o.y);
    if (x < 0 || y < -2) continue;
    maxX = Math.max(maxX, x);

    if (SOLID_IDS.has(o.id)) {
      blocks.push({ x, y });
    } else if (SPIKE_IDS.has(o.id)) {
      // GD encodes orientation as rotation plus a vertical flip; we only need
      // the four cardinal directions.
      let r = ((Math.round(o.rot / 90) * 90) % 360 + 360) % 360;
      if (o.flipY) r = (r + 180) % 360;
      const spike = { t: "spike", x, y };
      if (r) spike.r = r;
      if (SHORT_SPIKE_IDS.has(o.id)) spike.short = true;
      rest.push(spike);
    } else if (SHIP_PORTAL_IDS.has(o.id)) {
      rest.push({ t: "ship", x, y });
    } else if (CUBE_PORTAL_IDS.has(o.id)) {
      rest.push({ t: "cube", x, y });
    } else if (PAD_IDS.has(o.id)) {
      rest.push({ t: "pad", x, y });
    } else if (RING_IDS.has(o.id)) {
      rest.push({ t: "ring", x, y });
    } else if (!DECORATION_IDS.has(o.id)) {
      unknown.set(o.id, (unknown.get(o.id) ?? 0) + 1);
    }
  }

  // Portals define the ship corridors, and a ship section with no ceiling plays
  // as an empty void, so give each one a generous ceiling as a zone.
  const portals = rest
    .filter((o) => o.t === "ship" || o.t === "cube")
    .sort((a, b) => a.x - b.x);
  const zones = [];
  for (let i = 0; i < portals.length; i++) {
    if (portals[i].t !== "ship") continue;
    const next = portals.slice(i + 1).find((p) => p.t === "cube");
    const end = next ? next.x : maxX + 2;
    zones.push({ t: "zone", x: portals[i].x, w: Math.max(1, end - portals[i].x), ceilingY: 16 });
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
      rev: 1,
      name: meta.name,
      author: "RobTop Games",
      credit: "Level design by RobTop Games. Recreated for a portfolio project.",
      startMode: "cube",
      speed: 1,
      groundY: 0,
      ceilingY: null,
      objects: objectsOut,
    },
    stats: { blocks: blocks.length, rest: rest.length, maxX, unknown },
  };
}

/**
 * One object per line.
 *
 * JSON.stringify(doc, null, 2) explodes every object across five lines, which
 * makes a level diff unreadable — and the whole point of a text level format is
 * that you can see what moved.
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
  const put = (x, y, ch) => grid.set(`${x},${y}`, ch);

  for (const o of doc.objects) {
    if (o.t === "block") {
      for (let i = 0; i < (o.w ?? 1); i++) put(o.x + i, o.y, "#");
    } else if (o.t === "spike") put(o.x, o.y, "^");
    else if (o.t === "ship") put(o.x, o.y, "S");
    else if (o.t === "cube") put(o.x, o.y, "C");
    else if (o.t === "pad") put(o.x, o.y, "P");
    else if (o.t === "ring") put(o.x, o.y, "o");
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

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error("usage: node scripts/import-gd-level.mjs <N.txt> <out.json> [--preview]");
  process.exit(1);
}

const text = decode(src);
const header = text.split(";")[0];
const headerKeys = Object.fromEntries(
  header.split(",").reduce((acc, v, i, arr) => (i % 2 ? [...acc, [arr[i - 1], v]] : acc), []),
);

const objects = parseObjects(text);
const { doc, stats } = convert(objects, {
  id: "stereo-madness",
  name: "Stereo Madness",
});

writeFileSync(dest, serialize(doc));

console.log(`source objects   ${objects.length}`);
console.log(`  solids         ${stats.blocks} -> ${doc.objects.filter((o) => o.t === "block").length} spans`);
console.log(`  gameplay other ${stats.rest}`);
console.log(`  length         ${stats.maxX} tiles`);
console.log(`  start mode     ${headerKeys.kA2 === "0" || !headerKeys.kA2 ? "cube" : headerKeys.kA2}`);
console.log(`written          ${dest} (${doc.objects.length} objects)`);

if (stats.unknown.size) {
  console.log(`\nunmapped ids (neither gameplay nor known decoration):`);
  for (const [id, n] of [...stats.unknown].sort((a, b) => b[1] - a[1])) {
    console.log(`  id ${id}  x${n}`);
  }
}

if (process.argv.includes("--preview")) {
  console.log(`\nfirst ${76} columns as imported:`);
  console.log(preview(doc));
}
