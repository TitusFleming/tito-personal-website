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

export type Vec3 = [number, number, number];

export type MaterialKey = "castIron" | "steel" | "aluminum" | "beige";

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
  group: "block" | "rotating" | "valvetrain" | "fuel" | "air";
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

// ── Parts ────────────────────────────────────────────────────────

const BLOCK: EnginePart = {
  id: "block",
  name: "Cylinder block",
  group: "block",
  material: "castIron",
  geometry: [
    // Upper block, deck down to the crank centerline.
    { kind: "box", size: [45, 16, 13], at: [0, 8, 0] },
    // Crankcase skirt below the crank.
    { kind: "box", size: [45, 7, 15], at: [0, -3.5, 0] },
  ],
  placements: [{ index: 1, position: [0, 0, 0] }],
  explodeDir: [0, 0, 0],
  explodeDistance: 0,
  blurb:
    "Alloy cast iron, and the reason everything else has somewhere to be. Cummins built the 855 around removable wet liners rather than boring the cylinders into the casting, so the block is a frame for six replaceable barrels instead of the wear surface itself.",
  spec: [
    { label: "Displacement", value: "855 cu in / 14.0 L" },
    { label: "Configuration", value: "In-line 6, four-stroke" },
    { label: "Material", value: "Alloy cast iron" },
  ],
};

const CRANKSHAFT: EnginePart = {
  id: "crankshaft",
  name: "Crankshaft",
  group: "rotating",
  material: "steel",
  geometry: [
    // Main journal running the length of the engine.
    { kind: "cylinder", rTop: 2.25, rBottom: 2.25, height: 46, segments: 24, spin: [0, 0, Math.PI / 2] },
    // Six throws, each offset by its firing-order angle.
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
    // Counterweights, hung opposite each throw.
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
  ],
  placements: [{ index: 1, position: [0, 0, 0] }],
  explodeDir: [0, -1, 0],
  explodeDistance: 14,
  blurb:
    "A high-tensile steel forging with induction-hardened fillets and journals, fully counterweighted and dynamically balanced. It rides on seven main bearings — replaceable steel-backed inserts rather than anything machined permanently into the block, which is the whole design philosophy of this engine in one component.",
  spec: [
    { label: "Stroke", value: "6.00 in" },
    { label: "Main bearings", value: "Seven" },
    { label: "Material", value: "Forged steel" },
  ],
};

const PISTONS: EnginePart = {
  id: "piston",
  name: "Pistons",
  group: "rotating",
  material: "aluminum",
  geometry: [
    { kind: "cylinder", rTop: BORE / 2 - 0.03, rBottom: BORE / 2 - 0.03, height: 5.4, segments: 24 },
    // Three compression rings and one oil ring, per the spec sheet.
    { kind: "torus", radius: BORE / 2 - 0.06, tube: 0.07, segments: 24, at: [0, 2.0, 0], spin: [Math.PI / 2, 0, 0] },
    { kind: "torus", radius: BORE / 2 - 0.06, tube: 0.07, segments: 24, at: [0, 1.6, 0], spin: [Math.PI / 2, 0, 0] },
    { kind: "torus", radius: BORE / 2 - 0.06, tube: 0.07, segments: 24, at: [0, 1.2, 0], spin: [Math.PI / 2, 0, 0] },
    { kind: "torus", radius: BORE / 2 - 0.06, tube: 0.09, segments: 24, at: [0, 0.3, 0], spin: [Math.PI / 2, 0, 0] },
  ],
  placements: sixCylinders((cyl) => ({
    index: cyl,
    position: [cylX(cyl), pinHeight(cyl) + 0.9, 0],
    // Straight up its own bore — the direction that reads as
    // "this came out of that hole".
    explodeDir: [0, 1, 0],
    // Staggered so six pistons don't stack into a single column.
    explodeDistance: 26 + cyl * 1.1,
  })),
  explodeDir: [0, 1, 0],
  explodeDistance: 26,
  blurb:
    "Aluminum alloy, oil-cooled, and — the detail worth knowing — cam-ground and barrel-shaped rather than round. A piston that measured perfectly circular on the bench would seize once it reached working temperature, so it is machined deliberately out of round and becomes round only when hot. Three compression rings and one oil ring.",
  spec: [
    { label: "Bore", value: "5.50 in" },
    { label: "Rings", value: "Three compression, one oil" },
    { label: "Material", value: "Aluminum alloy" },
  ],
};

export const ENGINE_PARTS: EnginePart[] = [BLOCK, CRANKSHAFT, PISTONS];

export const PICKABLE_PARTS = ENGINE_PARTS.filter((part) => part.pickable !== false);
