// Bake the AREDL demon list into Phlem.io's bot name pool.
//
//   node scripts/import-aredl-names.mjs
//
// Source: the All Rated Extreme Demons List public API
// (https://api.aredl.net/v2/api/aredl/levels). Every bot identity in Phlem.io
// is an extreme demon name; the list is ~1,600 strong, which is ~80x the
// number of bots alive at once — far past the "5-10x" floor the design asks
// for, so name reuse within a session is effectively impossible.
//
// Committed as JSON rather than fetched at runtime: the game must not depend
// on a third-party API being up, and the list only changes when new demons
// are rated. Re-run this script to refresh it.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../app/projects/phlem-io/engine/names.json",
);

const res = await fetch("https://api.aredl.net/v2/api/aredl/levels", {
  headers: { Accept: "application/json" },
});
if (!res.ok) throw new Error(`AREDL API returned ${res.status}`);
const levels = await res.json();

// Position order preserved: index 0 is the hardest demon on the list, which
// costs nothing and makes the data pleasant to read.
const names = [];
const seen = new Set();
for (const level of levels) {
  const name = String(level.name ?? "").trim();
  if (!name || seen.has(name.toLowerCase())) continue;
  seen.add(name.toLowerCase());
  names.push(name);
}

if (names.length < 500) throw new Error(`Only ${names.length} names; API shape changed?`);

writeFileSync(OUT, JSON.stringify(names, null, 0).replace(/","/g, '",\n"') + "\n");
console.log(`wrote ${names.length} names to ${OUT}`);
