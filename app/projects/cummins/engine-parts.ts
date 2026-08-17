// Cummins NTC-400 Big Cam III — part data.
//
// This file must NOT import `three`. It is reachable from engine-explorer,
// which loads eagerly, so a single `new Vector3()` here would drag all ~165 KB
// of three into the initial payload and make the dynamic import in
// engine-explorer.tsx purely decorative. Plain tuples only; build-engine.ts
// converts them into real three objects on the far side of the split.
//
// Dimensions are in INCHES, straight off the spec sheet — 5.50 bore, 6.00
// stroke, 6.50 bore spacing — so every number below is one you can look up
// rather than a magic constant. The root group is scaled once at assembly.
//
// Facts in the blurbs come from a Cummins NTA855-G2 Big Cam III spec sheet
// (CPL 1383) wherever the wording is quoted. That sheet is a generator-drive
// variant: it shares the 855 architecture with the NTC-400 truck engine, but
// its power ratings, weight and dimensions do NOT transfer and are not used.

export type Vec3 = [number, number, number];

export type MaterialKey = "castIron" | "steel" | "aluminum" | "beige";

export type PartGroupName =
  | "Block"
  | "Rotating assembly"
  | "Valve train"
  | "Fuel system"
  | "Air system";

export type GeometrySpec =
  | { kind: "box"; size: Vec3; at?: Vec3; spin?: Vec3 }
  | {
      kind: "cylinder";
      rTop: number;
      rBottom: number;
      height: number;
      segments?: number;
      open?: boolean;
      at?: Vec3;
      spin?: Vec3;
    }
  | {
      kind: "tube";
      rOuter: number;
      rInner: number;
      height: number;
      segments?: number;
      at?: Vec3;
      spin?: Vec3;
    }
  | { kind: "torus"; radius: number; tube: number; segments?: number; at?: Vec3; spin?: Vec3 };

/** One physical instance of a part. Six pistons are six placements of one
 *  EnginePart, not six EngineParts. */
export type PartPlacement = {
  /** 1-based; suffixes the mesh name for debugging ("piston-3"). */
  index: number;
  position: Vec3;
  rotation?: Vec3;
  /** Overrides the part-level vector. Repeats usually want their own, so they
   *  fan out instead of stacking into one column. */
  explodeDir?: Vec3;
  explodeDistance?: number;
};

export type EnginePart = {
  /** Stable id — also the URL fragment for deep links. */
  id: string;
  name: string;
  group: PartGroupName;
  /** Several specs merge into one mesh group: a piston is a slug plus three
   *  ring lands, but it selects and explodes as a single thing. */
  geometry: GeometrySpec[];
  material: MaterialKey;
  placements: PartPlacement[];
  explodeDir: Vec3;
  explodeDistance: number;
  /** Structural filler stays in the scene but out of the raycast and the list. */
  pickable?: boolean;
  blurb: string;
  spec?: { label: string; value: string }[];
};

// ── Engine geometry constants ────────────────────────────────────

export const BORE = 5.5;
export const STROKE = 6.0;
export const BORE_SPACING = 6.5;
export const ROD_LENGTH = 12.5;
/** Deck height above the crank centerline. */
export const DECK = 16.0;
/** Camshaft sits in the block, offset to one side — this is a pushrod engine. */
const CAM_Y = 6.0;
const CAM_Z = 5.6;

/** Cylinder 1 at the front (−X). Centered so the block straddles the origin. */
export const cylX = (cyl: number): number => (cyl - 3.5) * BORE_SPACING;

/** NT-855 firing order. Sets each throw's angle, which sets each piston's
 *  height — six pistons at six different heights rather than a flat rank.
 *  This is the single detail that makes it read as an inline-six. */
const FIRING_ORDER = [1, 5, 3, 6, 2, 4];
export const throwAngle = (cyl: number): number =>
  (FIRING_ORDER.indexOf(cyl) * Math.PI * 2) / 6;

/** Slider-crank: y = r·cos θ + √(L² − (r·sin θ)²). */
export function pinHeight(cyl: number): number {
  const r = STROKE / 2;
  const a = throwAngle(cyl);
  return r * Math.cos(a) + Math.sqrt(ROD_LENGTH ** 2 - (r * Math.sin(a)) ** 2);
}

/** Crank throw center for a cylinder — where the big end rides. */
export function throwCenter(cyl: number): Vec3 {
  const r = STROKE / 2;
  const a = throwAngle(cyl);
  return [cylX(cyl), r * Math.cos(a), r * Math.sin(a)];
}

const sixCylinders = <T,>(fn: (cyl: number) => T): T[] => [1, 2, 3, 4, 5, 6].map(fn);

/** Heads and rocker housings each span two cylinders, so they sit on the
 *  midpoint of a pair: cylinders 1-2, 3-4, 5-6. */
const headX = (pair: number): number => (cylX(pair * 2 - 1) + cylX(pair * 2)) / 2;
const threePairs = <T,>(fn: (pair: number) => T): T[] => [1, 2, 3].map(fn);

// ── Parts ────────────────────────────────────────────────────────

const BLOCK: EnginePart = {
  id: "block",
  name: "Cylinder block",
  group: "Block",
  material: "castIron",
  geometry: [
    { kind: "box", size: [45, 16, 13], at: [0, 8, 0] },
    { kind: "box", size: [45, 7, 15], at: [0, -3.5, 0] },
    // Head-bolt bosses down both deck rails.
    ...[-5.4, 5.4].flatMap((z) =>
      Array.from({ length: 13 }, (_, i): GeometrySpec => ({
        kind: "cylinder", rTop: 0.72, rBottom: 0.72, height: 1.5, segments: 10,
        at: [-19.5 + i * 3.25, 16.3, z],
      })),
    ),
    // Cast ribbing down the crankcase flanks.
    ...[6.7, -6.7].flatMap((z) =>
      Array.from({ length: 7 }, (_, i): GeometrySpec => ({
        kind: "box", size: [1.2, 13, 0.6], at: [-18 + i * 6, 5, z],
      })),
    ),
    // Freeze plugs.
    ...Array.from({ length: 4 }, (_, i): GeometrySpec => ({
      kind: "cylinder", rTop: 1.6, rBottom: 1.6, height: 0.6, segments: 16,
      at: [-14.5 + i * 9.5, 10.5, -6.9], spin: [Math.PI / 2, 0, 0],
    })),
    // Gear-train cover at the front of the block.
    { kind: "cylinder", rTop: 6.2, rBottom: 6.2, height: 1.8, segments: 28, at: [-23.2, 3, 0], spin: [0, 0, Math.PI / 2] },
    // Main bearing caps along the bottom of the crankcase.
    ...Array.from({ length: 7 }, (_, i): GeometrySpec => ({
      kind: "box", size: [3.2, 2.6, 7], at: [-19.5 + i * 6.5, -7.4, 0],
    })),
  ],
  placements: [{ index: 1, position: [0, 0, 0] }],
  explodeDir: [0, 0, 0],
  explodeDistance: 0,
  blurb:
    "Alloy cast iron, and the reason everything else has somewhere to be. Cummins built the 855 around removable wet liners rather than boring the cylinders straight into the casting, so the block is a frame for six replaceable barrels instead of being the wear surface itself.",
  spec: [
    { label: "Displacement", value: "855 cu in / 14.0 L" },
    { label: "Configuration", value: "In-line 6, four-stroke" },
    { label: "Material", value: "Alloy cast iron" },
  ],
};

const LINERS: EnginePart = {
  id: "liner",
  name: "Cylinder liners",
  group: "Block",
  material: "steel",
  geometry: [
    { kind: "tube", rOuter: BORE / 2 + 0.35, rInner: BORE / 2, height: 15, segments: 28 },
    // Flange that lands on the deck.
    { kind: "torus", radius: BORE / 2 + 0.4, tube: 0.22, segments: 28, at: [0, 7.2, 0], spin: [Math.PI / 2, 0, 0] },
  ],
  placements: sixCylinders((cyl) => ({
    index: cyl,
    position: [cylX(cyl), 8.2, 0],
    explodeDir: [0, 1, 0],
    explodeDistance: 17 + cyl * 0.4,
  })),
  explodeDir: [0, 1, 0],
  explodeDistance: 17,
  blurb:
    "Wet liners, which is the whole design argument of this engine. The coolant touches the liner directly instead of circulating through jackets cast into the block — Cummins' own line is that they “dissipate heat faster than dry liners and are easily replaced without reboring the block.” Six barrels you pull and swap, rather than a block you have to machine.",
  spec: [
    { label: "Type", value: "Replaceable wet" },
    { label: "Bore", value: "5.50 in" },
    { label: "Count", value: "Six" },
  ],
};

const PISTONS: EnginePart = {
  id: "piston",
  name: "Pistons",
  group: "Rotating assembly",
  material: "aluminum",
  geometry: [
    { kind: "cylinder", rTop: BORE / 2 - 0.03, rBottom: BORE / 2 - 0.03, height: 5.4, segments: 24 },
    // Three compression rings and one oil ring, per the spec sheet.
    { kind: "torus", radius: BORE / 2 - 0.06, tube: 0.07, segments: 24, at: [0, 2.0, 0], spin: [Math.PI / 2, 0, 0] },
    { kind: "torus", radius: BORE / 2 - 0.06, tube: 0.07, segments: 24, at: [0, 1.6, 0], spin: [Math.PI / 2, 0, 0] },
    { kind: "torus", radius: BORE / 2 - 0.06, tube: 0.07, segments: 24, at: [0, 1.2, 0], spin: [Math.PI / 2, 0, 0] },
    { kind: "torus", radius: BORE / 2 - 0.06, tube: 0.09, segments: 24, at: [0, 0.3, 0], spin: [Math.PI / 2, 0, 0] },
    // Combustion bowl in the crown. This is a direct-injection diesel, so the
    // chamber is a dish in the piston rather than a pocket in the head.
    { kind: "torus", radius: 1.75, tube: 0.42, segments: 22, at: [0, 2.62, 0], spin: [Math.PI / 2, 0, 0] },
    { kind: "cylinder", rTop: 1.5, rBottom: 1.95, height: 0.7, segments: 20, at: [0, 2.4, 0] },
    // Pin bosses.
    { kind: "cylinder", rTop: 0.95, rBottom: 0.95, height: 4.6, segments: 14, at: [0, -0.6, 0], spin: [0, 0, Math.PI / 2] },
  ],
  placements: sixCylinders((cyl) => ({
    index: cyl,
    position: [cylX(cyl), pinHeight(cyl) + 0.9, 0],
    // Straight up its own bore — the direction that reads as
    // "this came out of that hole".
    explodeDir: [0, 1, 0],
    // Staggered so six pistons don't stack into a single column.
    explodeDistance: 24 + cyl * 0.4,
  })),
  explodeDir: [0, 1, 0],
  explodeDistance: 24,
  blurb:
    "Aluminum alloy, oil-cooled, and — the detail worth knowing — cam-ground and barrel-shaped rather than round. A piston that measured perfectly circular on the bench would seize once it reached working temperature, so it is machined deliberately out of round and becomes round only when hot. Three compression rings and one oil ring.",
  spec: [
    { label: "Bore", value: "5.50 in" },
    { label: "Rings", value: "Three compression, one oil" },
    { label: "Material", value: "Aluminum alloy" },
  ],
};

const CONNECTING_RODS: EnginePart = {
  id: "conrod",
  name: "Connecting rods",
  group: "Rotating assembly",
  material: "steel",
  geometry: [
    // Shank, centered on the origin and pointing up; each placement rotates it
    // onto the line between its crank throw and its piston pin.
    { kind: "box", size: [1.5, ROD_LENGTH - 2.2, 0.9] },
    // Big end (crank) and small end (pin).
    { kind: "cylinder", rTop: 1.9, rBottom: 1.9, height: 3.1, segments: 20, at: [0, -ROD_LENGTH / 2, 0], spin: [0, 0, Math.PI / 2] },
    { kind: "cylinder", rTop: 1.0, rBottom: 1.0, height: 2.4, segments: 16, at: [0, ROD_LENGTH / 2, 0], spin: [0, 0, Math.PI / 2] },
  ],
  placements: sixCylinders((cyl) => {
    const [x, throwY, throwZ] = throwCenter(cyl);
    const pinY = pinHeight(cyl);
    const dy = pinY - throwY;
    const dz = -throwZ;
    // Default cylinder/box axis is +Y; rotating about X by θ sends it to
    // (0, cos θ, sin θ), so θ = atan2(dz, dy) aims it at the pin.
    return {
      index: cyl,
      position: [x, (throwY + pinY) / 2, throwZ / 2] as Vec3,
      rotation: [Math.atan2(dz, dy), 0, 0] as Vec3,
      explodeDir: [0, 1, 0] as Vec3,
      explodeDistance: 10 + cyl * 0.4,
    };
  }),
  explodeDir: [0, 1, 0],
  explodeDistance: 10,
  blurb:
    "Drop-forged, and rifle-drilled: there is an oil passage bored down the length of the shank to feed the piston pin under pressure. The rod is tapered toward the pin end to reduce unit pressures. Neither of those is visible on a solid part, which is exactly the kind of thing an exploded view exists to point at.",
  spec: [
    { label: "Center distance", value: "12.5 in (approx.)" },
    { label: "Lubrication", value: "Rifle-drilled to the pin" },
    { label: "Pin", value: "Full floating, tubular steel" },
  ],
};

const CRANKSHAFT: EnginePart = {
  id: "crankshaft",
  name: "Crankshaft",
  group: "Rotating assembly",
  material: "steel",
  geometry: [
    { kind: "cylinder", rTop: 2.25, rBottom: 2.25, height: 46, segments: 24, spin: [0, 0, Math.PI / 2] },
    ...sixCylinders((cyl): GeometrySpec => {
      const [x, y, z] = throwCenter(cyl);
      return {
        kind: "cylinder",
        rTop: 1.9,
        rBottom: 1.9,
        height: 3.2,
        segments: 20,
        at: [x, y, z],
        spin: [0, 0, Math.PI / 2],
      };
    }),
    ...sixCylinders((cyl): GeometrySpec => {
      const a = throwAngle(cyl);
      const r = STROKE / 2;
      return {
        kind: "cylinder",
        rTop: 3.6,
        rBottom: 3.6,
        height: 1.5,
        segments: 20,
        at: [cylX(cyl) + 2.6, -r * Math.cos(a) * 0.7, -r * Math.sin(a) * 0.7],
        spin: [0, 0, Math.PI / 2],
      };
    }),
    // Vibration damper at the front, output flange at the back.
    { kind: "cylinder", rTop: 5.4, rBottom: 5.4, height: 2.4, segments: 32, at: [-24.5, 0, 0], spin: [0, 0, Math.PI / 2] },
    { kind: "cylinder", rTop: 3.4, rBottom: 3.4, height: 1.4, segments: 26, at: [24, 0, 0], spin: [0, 0, Math.PI / 2] },
  ],
  placements: [{ index: 1, position: [0, 0, 0] }],
  explodeDir: [0, -1, 0.3],
  explodeDistance: 21,
  blurb:
    "A high-tensile steel forging with induction-hardened fillets and journals, fully counterweighted and dynamically balanced. It rides on seven main bearings — replaceable, precision, steel-backed inserts rather than anything machined permanently into the block, which is this engine's whole philosophy in one component.",
  spec: [
    { label: "Stroke", value: "6.00 in" },
    { label: "Main bearings", value: "Seven" },
    { label: "Material", value: "Forged steel" },
  ],
};

const CAMSHAFT: EnginePart = {
  id: "camshaft",
  name: "Camshaft",
  group: "Valve train",
  material: "steel",
  geometry: [
    { kind: "cylinder", rTop: 0.95, rBottom: 0.95, height: 40, segments: 20, spin: [0, 0, Math.PI / 2] },
    // Three lobes per cylinder — intake, exhaust, injector — all off one shaft.
    ...sixCylinders((cyl) =>
      [-1.25, 0, 1.25].map(
        (dx): GeometrySpec => ({
          kind: "cylinder",
          rTop: 1.7,
          rBottom: 1.7,
          height: 0.85,
          segments: 18,
          at: [cylX(cyl) + dx, 0.35, 0],
          spin: [0, 0, Math.PI / 2],
        }),
      ),
    ).flat(),
    // Helical timing gear, driven from the crank at the front of the block.
    { kind: "cylinder", rTop: 3.3, rBottom: 3.3, height: 0.9, segments: 30, at: [-19.5, 0, 0], spin: [0, 0, Math.PI / 2] },
  ],
  placements: [{ index: 1, position: [0, CAM_Y, CAM_Z] }],
  explodeDir: [0, -0.45, 1],
  explodeDistance: 21,
  blurb:
    "The Big Cam — the engine is named after it. Cummins moved to a larger-diameter camshaft in 1976, and this is a single shaft that, in their words, “precisely controls valve and injector timing.” One camshaft doing both jobs is why the fuel system needs no electronics: the timing is a shape ground into steel. Lobes are induction hardened, the followers are roller type, and it runs in seven replaceable precision bushings.",
  spec: [
    { label: "Drive", value: "Helical gear, front of block" },
    { label: "Lobes", value: "Three per cylinder" },
    { label: "Bushings", value: "Seven, replaceable" },
  ],
};

const CYLINDER_HEADS: EnginePart = {
  id: "head",
  name: "Cylinder heads",
  group: "Block",
  material: "castIron",
  geometry: [
    { kind: "box", size: [12.4, 5.0, 13] },
    // Rocker housing riding on top.
    { kind: "box", size: [11.6, 3.4, 9], at: [0, 4.2, 0] },
    // Head bolts.
    ...[-5.6, 5.6].flatMap((z) =>
      [-4.6, 0, 4.6].map((x): GeometrySpec => ({
        kind: "cylinder", rTop: 0.5, rBottom: 0.5, height: 1.2, segments: 10, at: [x, 2.9, z],
      })),
    ),
    // Exhaust ports out the back.
    ...[-3.2, 3.2].map((x): GeometrySpec => ({
      kind: "cylinder", rTop: 1.6, rBottom: 1.6, height: 3.4, segments: 16,
      at: [x, 0.2, -7.6], spin: [Math.PI / 2, 0, 0],
    })),
    // Intake ports out the front.
    ...[-3.2, 3.2].map((x): GeometrySpec => ({
      kind: "cylinder", rTop: 1.7, rBottom: 1.7, height: 2.8, segments: 16,
      at: [x, 0.2, 7.3], spin: [Math.PI / 2, 0, 0],
    })),
  ],
  placements: threePairs((pair) => ({
    index: pair,
    position: [headX(pair), DECK + 2.5, 0],
    explodeDir: [0, 1, 0],
    explodeDistance: 31 + pair * 1.2,
  })),
  explodeDir: [0, 1, 0],
  explodeDistance: 31,
  blurb:
    "Three of them, and each serves two cylinders — not one head spanning all six. Alloy cast iron, with replaceable corrosion-resistant valve seat inserts and replaceable valve and crosshead guides. The detail worth knowing: the fuel supply and return lines are drilled passages inside the casting. There are no external lines running to the injectors; the fuel path is inside the iron.",
  spec: [
    { label: "Count", value: "Three" },
    { label: "Coverage", value: "Two cylinders each" },
    { label: "Fuel lines", value: "Drilled internal passages" },
  ],
};

const VALVE_TRAIN: EnginePart = {
  id: "valve-train",
  name: "Valve train",
  group: "Valve train",
  material: "steel",
  geometry: [
    // Pushrod running from the cam follower up to the rocker.
    { kind: "cylinder", rTop: 0.28, rBottom: 0.28, height: 12.5, segments: 12 },
    // Rocker lever across the top.
    { kind: "box", size: [1.3, 0.62, 4.8], at: [0, 6.9, -1.4] },
    { kind: "cylinder", rTop: 0.62, rBottom: 0.62, height: 1.9, segments: 14, at: [0, 6.9, -0.4], spin: [0, 0, Math.PI / 2] },
    // Crosshead the lever presses on, bridging a pair of valves.
    { kind: "box", size: [0.9, 0.6, 2.4], at: [0, 6.1, -2.6] },
  ],
  placements: sixCylinders((cyl) =>
    // Three levers per cylinder: intake, injector, exhaust.
    [-2.2, 0, 2.2].map((dx, k) => ({
      index: (cyl - 1) * 3 + k + 1,
      position: [cylX(cyl) + dx, 12.5, CAM_Z - 1.2] as Vec3,
      explodeDir: [0, 1, 0.35] as Vec3,
      explodeDistance: 34 + k * 1.0,
    })),
  ).flat(),
  explodeDir: [0, 1, 0.35],
  explodeDistance: 34,
  blurb:
    "Three rocker levers per cylinder — intake, exhaust, and injector — all driven off the one camshaft through their own pushrods, six of which do nothing but work injectors. The valve levers never touch a valve directly: a crosshead bridges a pair of them, so one lever opens two valves at once. That is why the head casting has replaceable crosshead guides in it as well as valve guides.",
  spec: [
    { label: "Levers", value: "Three per cylinder" },
    { label: "Actuation", value: "Pushrod, cam-in-block" },
    { label: "Bridging", value: "Crosshead per valve pair" },
  ],
};

const INJECTORS: EnginePart = {
  id: "injector",
  name: "PT injectors",
  group: "Fuel system",
  material: "beige",
  geometry: [
    { kind: "cylinder", rTop: 0.62, rBottom: 0.62, height: 4.6, segments: 16 },
    { kind: "cylinder", rTop: 0.95, rBottom: 0.95, height: 0.8, segments: 16, at: [0, 1.6, 0] },
    { kind: "cylinder", rTop: 0.3, rBottom: 0.18, height: 1.2, segments: 12, at: [0, -2.7, 0] },
  ],
  placements: sixCylinders((cyl) => ({
    index: cyl,
    position: [cylX(cyl), DECK + 3.0, 0],
    explodeDir: [0, 1, 0.4],
    explodeDistance: 39 + cyl * 0.5,
  })),
  explodeDir: [0, 1, 0.4],
  explodeDistance: 39,
  blurb:
    "Camshaft-actuated unit injectors, which Cummins credits for “accurate metering and timing.” Timing is hydraulic: fuel pressure builds against a spring inside the injector until it lifts. There is no pump-to-engine timing to set on this engine, because the camshaft is the timing — an injector fires when its lobe comes round, and not a degree before.",
  spec: [
    { label: "Type", value: "Unit, cam-actuated" },
    { label: "Timing", value: "Hydraulic, spring-referenced" },
    { label: "Count", value: "Six" },
  ],
};

const PT_PUMP: EnginePart = {
  id: "pt-pump",
  name: "PT fuel pump",
  group: "Fuel system",
  material: "aluminum",
  geometry: [
    { kind: "box", size: [9, 6, 5.5] },
    // Governor housing on the end of the pump.
    { kind: "cylinder", rTop: 2.9, rBottom: 2.9, height: 4.2, segments: 24, at: [5.6, 0.5, 0], spin: [0, 0, Math.PI / 2] },
    // Throttle shaft.
    { kind: "cylinder", rTop: 0.35, rBottom: 0.35, height: 4.0, segments: 12, at: [-1.5, 3.4, 0] },
  ],
  placements: [{ index: 1, position: [-15, 12.5, 8.6] }],
  explodeDir: [-0.35, 0.25, 1],
  explodeDistance: 25,
  blurb:
    "Pressure-Time — the PT in every part name on this engine. There is no conventional injection pump: a gear pump supplies fuel at pressure, and how much reaches a cylinder is set by that pressure acting against a metering valve and the throttle shaft, held across the range by a mechanical centrifugal governor. A separate flyweight governor provides overspeed protection independent of the main one. No sensors, no control unit, nothing to plug a laptop into. This is the entire computer.",
  spec: [
    { label: "Principle", value: "Pressure and time" },
    { label: "Governing", value: "Mechanical centrifugal" },
    { label: "Overspeed", value: "Independent flyweight" },
  ],
};

const TURBOCHARGER: EnginePart = {
  id: "turbocharger",
  name: "Turbocharger",
  group: "Air system",
  material: "steel",
  geometry: [
    // Turbine and compressor volutes either side of a bearing housing.
    { kind: "cylinder", rTop: 4.0, rBottom: 4.0, height: 3.2, segments: 26, spin: [0, 0, Math.PI / 2] },
    // Turbine volute — the scroll that makes a turbo look like a turbo.
    { kind: "torus", radius: 3.5, tube: 1.5, segments: 26, at: [0, 0, 0], spin: [0, Math.PI / 2, 0] },
    { kind: "torus", radius: 3.1, tube: 1.3, segments: 26, at: [5.6, 0, 0], spin: [0, Math.PI / 2, 0] },
    // Exhaust inlet flange.
    { kind: "cylinder", rTop: 1.8, rBottom: 1.8, height: 2.6, segments: 16, at: [0, -3.6, 0] },
    { kind: "cylinder", rTop: 3.6, rBottom: 3.6, height: 3.0, segments: 26, at: [5.6, 0, 0], spin: [0, 0, Math.PI / 2] },
    { kind: "cylinder", rTop: 1.5, rBottom: 1.5, height: 2.8, segments: 18, at: [2.8, 0, 0], spin: [0, 0, Math.PI / 2] },
    // Compressor outlet.
    { kind: "cylinder", rTop: 1.6, rBottom: 1.6, height: 3.0, segments: 16, at: [5.6, 0, 3.4] },
  ],
  placements: [{ index: 1, position: [6, 24, -9] }],
  explodeDir: [0.1, 0.45, -1],
  explodeDistance: 24,
  blurb:
    "A Holset — founded in Huddersfield, England in 1952 and bought by Cummins in 1973, so by the time this engine was built the turbocharger was already made in-house. It feeds a three-pass aftercooler that sits inside the engine's own coolant system, which Cummins notes eliminates the need for special plumbing.",
  spec: [
    { label: "Make", value: "Holset" },
    { label: "In-house since", value: "1973" },
    { label: "Charge cooling", value: "Three-pass aftercooler" },
  ],
};

const FLYWHEEL: EnginePart = {
  id: "flywheel",
  name: "Flywheel & housing",
  group: "Rotating assembly",
  material: "castIron",
  geometry: [
    { kind: "cylinder", rTop: 8.6, rBottom: 8.6, height: 2.2, segments: 40, spin: [0, 0, Math.PI / 2] },
    // Ring gear the starter engages.
    { kind: "torus", radius: 8.7, tube: 0.5, segments: 40, at: [1.2, 0, 0], spin: [0, Math.PI / 2, Math.PI / 2] },
    // Bellhousing.
    { kind: "cylinder", rTop: 9.6, rBottom: 9.6, height: 3.0, segments: 32, at: [-3.2, 0, 0], spin: [0, 0, Math.PI / 2] },
  ],
  placements: [{ index: 1, position: [25, 0, 0] }],
  explodeDir: [1, 0, 0],
  explodeDistance: 24,
  blurb:
    "Where the power finally leaves the engine. The flywheel housing is the bolt pattern everything downstream hangs off, and the wheel itself is the mass that carries the crankshaft between firing pulses — in a big, slow six those pulses are far enough apart that the engine needs the inertia to get from one to the next smoothly.",
  spec: [
    { label: "Ring gear", value: "Starter engagement" },
    { label: "Function", value: "Inertia between firing pulses" },
  ],
};

const EXHAUST_MANIFOLD: EnginePart = {
  id: "exhaust-manifold",
  name: "Exhaust manifold",
  group: "Air system",
  material: "castIron",
  geometry: [
    // Log running most of the length of the engine.
    { kind: "cylinder", rTop: 2.1, rBottom: 2.1, height: 40, segments: 20, spin: [0, 0, Math.PI / 2] },
    // Six runners reaching up to the exhaust ports in the heads.
    ...sixCylinders((cyl): GeometrySpec => ({
      kind: "cylinder", rTop: 1.5, rBottom: 1.5, height: 3.6, segments: 14,
      at: [cylX(cyl), 0.4, 1.8], spin: [Math.PI / 2, 0, 0],
    })),
    // Turbo mounting flange.
    { kind: "box", size: [4.4, 4.4, 1.2], at: [6, 0, -2.6] },
  ],
  placements: [{ index: 1, position: [0, DECK + 2.7, -10.4] }],
  explodeDir: [0, 0.15, -1],
  explodeDistance: 27,
  blurb:
    "Cast iron, and the piece that turns six separate exhaust pulses into one stream the turbocharger can live on. Each runner comes off a port drilled through the head; the log collects them and hands the lot to the turbine. It is also the hottest part on the engine, which is why it is iron rather than anything lighter.",
  spec: [
    { label: "Runners", value: "One per cylinder" },
    { label: "Material", value: "Cast iron" },
    { label: "Feeds", value: "Holset turbine" },
  ],
};

const OIL_PAN: EnginePart = {
  id: "oil-pan",
  name: "Oil pan",
  group: "Block",
  material: "castIron",
  geometry: [
    { kind: "box", size: [40, 5.5, 13] },
    { kind: "box", size: [42, 1, 14.4], at: [0, 2.6, 0] },
    // Drain plug.
    { kind: "cylinder", rTop: 0.7, rBottom: 0.7, height: 1.1, segments: 12, at: [16, -2.8, 0] },
  ],
  placements: [{ index: 1, position: [0, -9.2, 0] }],
  explodeDir: [0, -1, 0],
  explodeDistance: 30,
  blurb:
    "Ten gallons of oil live down here. The 855's lubrication circuit runs coolant through the lube oil cooler housing rather than the other way round, and a pressure switch in the filter head watches for full-flow plugging — on an engine with no electronics anywhere else, that switch is close to the only thing on it that reports a condition.",
  spec: [
    { label: "Oil capacity", value: "10.2 US gal / 38.6 L" },
    { label: "Material", value: "Cast iron" },
  ],
};

const GEAR_TRAIN: EnginePart = {
  id: "gear-train",
  name: "Gear train",
  group: "Valve train",
  material: "steel",
  geometry: [
    // Crank gear, cam gear, and two accessory drive idlers.
    { kind: "cylinder", rTop: 3.4, rBottom: 3.4, height: 1.1, segments: 34, at: [0, 0, 0], spin: [0, 0, Math.PI / 2] },
    { kind: "cylinder", rTop: 3.3, rBottom: 3.3, height: 1.1, segments: 34, at: [0, 6.2, 5.6], spin: [0, 0, Math.PI / 2] },
    { kind: "cylinder", rTop: 2.4, rBottom: 2.4, height: 1.0, segments: 28, at: [0, 6.6, -4.4], spin: [0, 0, Math.PI / 2] },
    { kind: "cylinder", rTop: 2.0, rBottom: 2.0, height: 1.0, segments: 26, at: [0, 12.4, 1.6], spin: [0, 0, Math.PI / 2] },
  ],
  placements: [{ index: 1, position: [-21.5, 0, 0] }],
  explodeDir: [-1, 0, 0],
  explodeDistance: 26,
  blurb:
    "Induction-hardened helical gears driven off the crankshaft at the front of the block. This is the mechanical spine of the whole engine: it is what keeps the camshaft — and therefore both the valves and the injection timing — in step with the crank. Nothing here is a sensor reading a position; the position is guaranteed by teeth.",
  spec: [
    { label: "Type", value: "Helical, induction hardened" },
    { label: "Location", value: "Front of block" },
    { label: "Drives", value: "Camshaft and accessories" },
  ],
};

const CAM_FOLLOWERS: EnginePart = {
  id: "cam-follower",
  name: "Cam followers",
  group: "Valve train",
  material: "steel",
  geometry: [
    { kind: "cylinder", rTop: 0.85, rBottom: 0.85, height: 1.0, segments: 16, spin: [0, 0, Math.PI / 2] },
    { kind: "cylinder", rTop: 0.42, rBottom: 0.42, height: 2.4, segments: 12, at: [0, 1.4, 0] },
  ],
  placements: sixCylinders((cyl) =>
    [-1.25, 0, 1.25].map((dx, k) => ({
      index: (cyl - 1) * 3 + k + 1,
      position: [cylX(cyl) + dx, CAM_Y + 2.4, CAM_Z] as Vec3,
      explodeDir: [0, 0.35, 1] as Vec3,
      explodeDistance: 30 + k * 0.8,
    })),
  ).flat(),
  explodeDir: [0, 0.35, 1],
  explodeDistance: 30,
  blurb:
    "Roller type, induction hardened. Each one rides a lobe and hands the motion up a pushrod — eighteen of them, three per cylinder, because on this engine the camshaft times the injectors as well as the valves. A roller rather than a flat face is what lets the Big Cam run the aggressive lobe profiles it does without scuffing.",
  spec: [
    { label: "Type", value: "Roller, induction hardened" },
    { label: "Count", value: "Eighteen" },
  ],
};

const INTAKE_MANIFOLD: EnginePart = {
  id: "intake-manifold",
  name: "Intake manifold",
  group: "Air system",
  material: "aluminum",
  geometry: [
    { kind: "box", size: [40, 5, 5.5] },
    ...sixCylinders((cyl): GeometrySpec => ({
      kind: "cylinder", rTop: 1.7, rBottom: 1.7, height: 3.2, segments: 14,
      at: [cylX(cyl), 0.2, -2.6], spin: [Math.PI / 2, 0, 0],
    })),
  ],
  placements: [{ index: 1, position: [0, DECK + 2.6, 10.6] }],
  explodeDir: [0, 0.15, 1],
  explodeDistance: 28,
  blurb:
    "Carries charge air from the aftercooler along the engine and into the six intake ports. On a turbocharged diesel this is the high-pressure side of the breathing system — everything the turbo compresses has to get down here before it does any good.",
  spec: [
    { label: "Feeds", value: "Six intake ports" },
    { label: "Fed by", value: "Aftercooler" },
  ],
};

const AFTERCOOLER: EnginePart = {
  id: "aftercooler",
  name: "Aftercooler",
  group: "Air system",
  material: "aluminum",
  geometry: [
    { kind: "box", size: [22, 6, 7] },
    { kind: "cylinder", rTop: 1.9, rBottom: 1.9, height: 3.2, segments: 18, at: [-12, 0, 0], spin: [0, 0, Math.PI / 2] },
    { kind: "cylinder", rTop: 1.9, rBottom: 1.9, height: 3.2, segments: 18, at: [12, 0, 0], spin: [0, 0, Math.PI / 2] },
    // Core fins.
    ...Array.from({ length: 9 }, (_, i): GeometrySpec => ({
      kind: "box", size: [0.5, 6.6, 7.4], at: [-9 + i * 2.3, 0, 0],
    })),
  ],
  placements: [{ index: 1, position: [-2, 27, 9 ] }],
  explodeDir: [0, 0.55, 1],
  explodeDistance: 33,
  blurb:
    "A three-pass design that sits inside the engine's own coolant system rather than needing its own plumbing. Compressing air heats it, and hot air is thin air; cooling the charge back down before it reaches the cylinders is what makes it dense enough to burn the fuel the PT system is metering out.",
  spec: [
    { label: "Design", value: "Three-pass" },
    { label: "Cooled by", value: "Engine coolant" },
  ],
};

const WATER_PUMP: EnginePart = {
  id: "water-pump",
  name: "Water pump",
  group: "Block",
  material: "castIron",
  geometry: [
    { kind: "cylinder", rTop: 3.2, rBottom: 3.2, height: 4.2, segments: 24, spin: [0, 0, Math.PI / 2] },
    { kind: "cylinder", rTop: 4.4, rBottom: 4.4, height: 1.2, segments: 26, at: [-3.2, 0, 0], spin: [0, 0, Math.PI / 2] },
    { kind: "cylinder", rTop: 1.6, rBottom: 1.6, height: 3.4, segments: 16, at: [1.5, -3.2, 0] },
  ],
  placements: [{ index: 1, position: [-26, 9, 5.5] }],
  explodeDir: [-1, 0.15, 0.5],
  explodeDistance: 28,
  blurb:
    "Belt-driven and centrifugal, pushing coolant through large-volume passages that run around the liners, the valves and the injectors. Because the liners are wet, this pump's output is in direct contact with the outside of all six cylinders — there is no jacket wall in between.",
  spec: [
    { label: "Type", value: "Centrifugal, belt driven" },
    { label: "Coolant capacity", value: "5.5 US gal / 20.8 L" },
  ],
};

const OIL_COOLER: EnginePart = {
  id: "oil-cooler",
  name: "Oil cooler & filters",
  group: "Block",
  material: "castIron",
  geometry: [
    { kind: "box", size: [14, 5.5, 5] },
    // Spin-on filter and corrosion resistor.
    { kind: "cylinder", rTop: 2.2, rBottom: 2.2, height: 6, segments: 20, at: [-4, -1, 4.4], spin: [Math.PI / 2, 0, 0] },
    { kind: "cylinder", rTop: 2.2, rBottom: 2.2, height: 6, segments: 20, at: [3, -1, 4.4], spin: [Math.PI / 2, 0, 0] },
  ],
  placements: [{ index: 1, position: [-4, 1.5, -10.5] }],
  explodeDir: [0, -0.2, -1],
  explodeDistance: 26,
  blurb:
    "Coolant runs through the lube oil cooler housing to pull heat out of the oil, and a spin-on corrosion resistor checks rust, controls acidity and strains out what the engine sheds. A pressure switch in the filter head watches for the full-flow element plugging — on an engine this determinedly mechanical, that switch is nearly the only part that reports anything.",
  spec: [
    { label: "Filtration", value: "Full flow and bypass" },
    { label: "Corrosion resistor", value: "Spin-on" },
  ],
};

/** Order is roughly the order you'd take it apart in, which also reads
 *  sensibly top-to-bottom in the part list. */
export const ENGINE_PARTS: EnginePart[] = [
  BLOCK,
  OIL_PAN,
  LINERS,
  PISTONS,
  CONNECTING_RODS,
  CRANKSHAFT,
  GEAR_TRAIN,
  CAMSHAFT,
  CAM_FOLLOWERS,
  CYLINDER_HEADS,
  VALVE_TRAIN,
  INJECTORS,
  PT_PUMP,
  EXHAUST_MANIFOLD,
  TURBOCHARGER,
  AFTERCOOLER,
  INTAKE_MANIFOLD,
  WATER_PUMP,
  OIL_COOLER,
  FLYWHEEL,
];

export const PICKABLE_PARTS = ENGINE_PARTS.filter((part) => part.pickable !== false);
