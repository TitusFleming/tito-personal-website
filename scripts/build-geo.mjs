/**
 * Builds the static map geometry for /projects/yourElections.
 *
 *   pnpm build:geo
 *
 * Inputs: Census cartographic boundary shapefiles (500k scale), cached in
 * .geo-cache/ (gitignored). Downloaded automatically on first run from
 * https://www2.census.gov/geo/tiger/GENZ2024/shp/
 *
 * Outputs (committed, served from Vercel's CDN):
 *   public/geo/states.topo.json      — 50 state outlines, one layer "states"
 *   public/geo/districts/{ST}.topo.json — that state's districts, layer "districts"
 *
 * Boundary vintage is the 119th Congress (currently seated districts) —
 * deliberately the same vintage as the backend's zip crosswalk, so the map
 * and the zip lookup can never disagree with each other.
 *
 * District numbering convention: integers 1..N matching the backend's OCD
 * IDs (ocd-division/.../cd:N), where at-large states are district 1.
 * Census codes at-large as "00"; "98" (non-voting delegate) and "ZZ"
 * (undefined) are dropped.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = join(root, ".geo-cache");
const outDir = join(root, "public", "geo");

const CENSUS_BASE = "https://www2.census.gov/geo/tiger/GENZ2024/shp";
const SOURCES = {
  state: "cb_2024_us_state_500k",
  cd119: "cb_2024_us_cd119_500k",
};

// FIPS -> USPS for the 50 states. DC (11) and territories are intentionally
// absent: the elections data covers Senate + House for states only.
const FIPS_TO_USPS = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "12": "FL", "13": "GA", "15": "HI", "16": "ID",
  "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA",
  "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ",
  "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK",
  "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN",
  "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY",
};

function ensureSource(name) {
  const dir = join(cacheDir, name);
  const shp = join(dir, `${SOURCES[name]}.shp`);
  if (existsSync(shp)) return shp;

  mkdirSync(dir, { recursive: true });
  const zip = join(cacheDir, `${SOURCES[name]}.zip`);
  if (!existsSync(zip)) {
    console.log(`Downloading ${SOURCES[name]}.zip …`);
    execFileSync("curl", ["-fsSL", "-o", zip, `${CENSUS_BASE}/${SOURCES[name]}.zip`]);
  }
  execFileSync("unzip", ["-o", "-q", zip, "-d", dir]);
  return shp;
}

function kb(path) {
  return `${Math.round(statSync(path).size / 1024)} KB`;
}

async function buildStates(stateShp) {
  const out = join(outDir, "states.topo.json");
  const fipsList = JSON.stringify(Object.keys(FIPS_TO_USPS));
  await mapshaper.runCommands(
    [
      `-i "${stateShp}"`,
      `-filter '${fipsList}.indexOf(STATEFP) > -1'`,
      "-simplify weighted 6% keep-shapes",
      "-clean",
      "-filter-fields STUSPS,NAME",
      "-rename-fields state=STUSPS,name=NAME",
      "-rename-layers states",
      `-o "${out}" format=topojson`,
    ].join(" "),
  );
  console.log(`states.topo.json  ${kb(out)}`);
}

async function buildDistricts(cdShp) {
  mkdirSync(join(outDir, "districts"), { recursive: true });
  for (const [fips, usps] of Object.entries(FIPS_TO_USPS)) {
    const out = join(outDir, "districts", `${usps}.topo.json`);
    await mapshaper.runCommands(
      [
        `-i "${cdShp}"`,
        // "98" = non-voting delegate seat, "ZZ" = undefined area (offshore
        // water). "00" = at-large, which we keep and renumber to 1.
        `-filter 'STATEFP == "${fips}" && CD119FP != "ZZ" && CD119FP != "98"'`,
        "-simplify weighted 15% keep-shapes",
        "-clean",
        `-each 'district = Math.max(1, parseInt(CD119FP, 10))'`,
        "-filter-fields district",
        "-rename-layers districts",
        `-o "${out}" format=topojson`,
      ].join(" "),
    );
  }
  console.log(`districts/*.topo.json written for ${Object.keys(FIPS_TO_USPS).length} states`);
}

const stateShp = ensureSource("state");
const cdShp = ensureSource("cd119");
mkdirSync(outDir, { recursive: true });
await buildStates(stateShp);
await buildDistricts(cdShp);
console.log("Done.");
