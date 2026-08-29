// Turns the plain data in engine-parts.ts into a three.js scene graph.
// This module owns every `three` import on the geometry side; engine-parts.ts
// stays dependency-free so it can live in the eager chunk.

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  Vector3,
} from "three";

import {
  ENGINE_PARTS,
  type EnginePart,
  type GeometrySpec,
  type MaterialKey,
  type Vec3,
} from "./engine-parts";

/** Inches → scene units. Every number in engine-parts.ts is a real dimension;
 *  this is the one place that stops mattering. */
export const SCENE_SCALE = 0.1;

// ── Materials ────────────────────────────────────────────────────

/** The site's untokenized rust (#7a3027, the .eyebrow color) doing double duty
 *  as the 3D highlight, so the model's accent matches the page's. */
const HIGHLIGHT = new Color("#7a3027");

type MaterialSet = {
  base: MeshStandardMaterial;
  hover: MeshStandardMaterial;
  active: MeshStandardMaterial;
  dim: MeshStandardMaterial;
};

/** Colors are picked by eye in the scene rather than matched to CSS hexes:
 *  three enables color management by default and ACES tone mapping darkens
 *  and desaturates everything, so a hex copied from globals.css does not
 *  land where you expect. */
const PALETTE: Record<MaterialKey, { color: string; metalness: number; roughness: number }> = {
  // Real cast iron is matte and dark, and pushing it dark and warm is what
  // separates the castings from the machined parts at a glance. An earlier
  // pass had all four of these within a few percent of each other and the
  // whole engine read as one grey mass.
  castIron: { color: "#413b34", metalness: 0.22, roughness: 0.88 },
  // Machined steel: the bright, cool, obviously-turned surfaces.
  steel: { color: "#dfe3e9", metalness: 0.97, roughness: 0.15 },
  // Aluminum sits between the two, light but warmer and softer than steel.
  aluminum: { color: "#b3aca1", metalness: 0.72, roughness: 0.38 },
  // Brass for the fuel system, which also ties it to the page's warm palette.
  beige: { color: "#b08a45", metalness: 0.88, roughness: 0.3 },
};

/** Four variants per key, built once. All are MeshStandardMaterial with the
 *  same (empty) texture set and identical defines, so three compiles one
 *  program and a selection change is a uniform update, not a recompile, 
 *  which is why hovering never hitches. Don't add a map to only some variants. */
export function buildMaterials(): { sets: Record<MaterialKey, MaterialSet>; all: MeshStandardMaterial[] } {
  const all: MeshStandardMaterial[] = [];
  const sets = {} as Record<MaterialKey, MaterialSet>;

  for (const key of Object.keys(PALETTE) as MaterialKey[]) {
    const { color, metalness, roughness } = PALETTE[key];

    const base = new MeshStandardMaterial({ color, metalness, roughness });
    const hover = new MeshStandardMaterial({
      color,
      metalness,
      roughness,
      emissive: HIGHLIGHT,
      emissiveIntensity: 0.22,
    });
    const active = new MeshStandardMaterial({
      color,
      metalness,
      roughness,
      emissive: HIGHLIGHT,
      emissiveIntensity: 0.5,
    });
    const dim = new MeshStandardMaterial({
      color,
      metalness,
      roughness,
      envMapIntensity: 0.3,
      opacity: 0.5,
      transparent: true,
    });
    dim.color.multiplyScalar(0.75);

    sets[key] = { base, hover, active, dim };
    all.push(base, hover, active, dim);
  }

  return { sets, all };
}

// ── Geometry ─────────────────────────────────────────────────────

function buildGeometry(spec: GeometrySpec): BufferGeometry {
  let geometry: BufferGeometry;

  switch (spec.kind) {
    case "box":
      geometry = new BoxGeometry(spec.size[0], spec.size[1], spec.size[2]);
      break;
    case "cylinder":
      geometry = new CylinderGeometry(
        spec.rTop,
        spec.rBottom,
        spec.height,
        spec.segments ?? 24,
        1,
        spec.open ?? false,
      );
      break;
    case "tube":
      // Read as a barrel from outside; the wall thickness isn't visible at
      // any angle the camera can reach, so one open shell is enough.
      geometry = new CylinderGeometry(spec.rOuter, spec.rOuter, spec.height, spec.segments ?? 24, 1, true);
      break;
    case "torus":
      geometry = new TorusGeometry(spec.radius, spec.tube, 10, spec.segments ?? 24);
      break;
  }

  // Bake the local transform into the geometry so a part's several specs can
  // share one group and move as a unit.
  if (spec.spin) {
    geometry.rotateX(spec.spin[0]);
    geometry.rotateY(spec.spin[1]);
    geometry.rotateZ(spec.spin[2]);
  }
  if (spec.at) {
    geometry.translate(spec.at[0], spec.at[1], spec.at[2]);
  }

  return geometry;
}

// ── Assembly ─────────────────────────────────────────────────────

export type PartNode = {
  object: Group;
  meshes: Mesh[];
  partId: string;
  materialKey: MaterialKey;
  /** Built once, never mutated, explode reads from it every frame. */
  assembled: Vector3;
  dir: Vector3;
  distance: number;
};

export type BuiltEngine = {
  root: Group;
  nodes: PartNode[];
  /** Flat list for the raycaster; excludes parts marked pickable: false. */
  pickables: Mesh[];
  geometries: BufferGeometry[];
  materials: MeshStandardMaterial[];
  sets: Record<MaterialKey, MaterialSet>;
};

export function buildEngine(): BuiltEngine {
  const root = new Group();
  root.scale.setScalar(SCENE_SCALE);

  const { sets, all: materials } = buildMaterials();
  const geometries: BufferGeometry[] = [];
  const nodes: PartNode[] = [];
  const pickables: Mesh[] = [];

  for (const part of ENGINE_PARTS) {
    // Built once per part and shared across every placement, six pistons are
    // six groups pointing at one set of geometries.
    const partGeometries = part.geometry.map(buildGeometry);
    geometries.push(...partGeometries);

    for (const placement of part.placements) {
      const group = new Group();
      group.position.set(...placement.position);
      if (placement.rotation) {
        group.rotation.set(...placement.rotation);
      }

      const meshes = partGeometries.map((geometry, i) => {
        const mesh = new Mesh(geometry, sets[part.material].base);
        mesh.name = `${part.id}-${placement.index}-${i}`;
        mesh.userData = { partId: part.id, placementIndex: placement.index };
        group.add(mesh);
        if (part.pickable !== false) pickables.push(mesh);
        return mesh;
      });

      root.add(group);
      nodes.push({
        object: group,
        meshes,
        partId: part.id,
        materialKey: part.material,
        assembled: new Vector3(...placement.position),
        dir: new Vector3(...(placement.explodeDir ?? part.explodeDir)).normalize(),
        distance: placement.explodeDistance ?? part.explodeDistance,
      });
    }
  }

  return { root, nodes, pickables, geometries, materials, sets };
}

// ── Explode ──────────────────────────────────────────────────────

/** Smootherstep. A linear ramp never lets the model look settled at either
 *  end of the slider; this gives it detents at "assembled" and "apart". */
function ease(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Assembled → exploded, every part in one pass.
 *
 * Each part rides its own authored unit vector. Nothing is derived from a
 * centroid: this engine is 45in long and 20in tall, so a radial blow-up fans
 * the end cylinders sideways and leaves cylinders 3 and 4 sitting inside the
 * block. The vectors are hand-set to match the reading order of the sculpture
 *, heads up, pan down, turbo out, which is a composition, not a simulation.
 *
 * Allocation-free: writes straight into each group's existing position.
 */
export function applyExplode(nodes: PartNode[], t: number): void {
  const k = ease(t);
  for (const node of nodes) {
    const d = k * node.distance;
    node.object.position.set(
      node.assembled.x + node.dir.x * d,
      node.assembled.y + node.dir.y * d,
      node.assembled.z + node.dir.z * d,
    );
  }
}

/** Selection is a material swap across every mesh in a node. */
export function applyEmphasis(
  nodes: PartNode[],
  sets: Record<MaterialKey, MaterialSet>,
  selectedId: string | null,
  hoveredId: string | null,
): void {
  for (const node of nodes) {
    const set = sets[node.materialKey];
    const material =
      node.partId === selectedId
        ? set.active
        : node.partId === hoveredId
          ? set.hover
          : selectedId !== null
            ? set.dim
            : set.base;
    for (const mesh of node.meshes) {
      mesh.material = material;
    }
  }
}

export type { EnginePart, Vec3 };
