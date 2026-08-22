// Canvas 2D renderer.
//
// Impure by definition, and deliberately kept away from the engine: nothing in
// here can affect the simulation, so changing how the game looks can never
// change how it plays (or break a replay tape).
//
// There are no image assets. Geometry Dash's art is geometric, so the cube,
// ship, blocks and spikes are all rects and triangles — nothing was extracted
// from the game to draw them.
//
// The palette is the game's, not the website's. An earlier version used the
// site's warm browns so the page would feel coherent; that was the wrong call.
// A Geometry Dash clone that isn't Geometry Dash blue reads as a different game.
//
// THE CAMERA TAKES AN INTERPOLATED POSITION, NOT THE SIMULATION.
// The sim runs at a fixed 240 Hz and the display refreshes at its own rate, so
// every frame sits some fraction of a step behind the latest state. That
// fraction is what `interpolate` applies. Feeding the camera raw simulation
// position instead quantises it to whole steps: at 60 Hz the world scrolled
// 3.89 or 5.19 or 6.49 px on consecutive near-identical frames, a 67% swing,
// while the player alone moved smoothly. The camera positions the ENTIRE world,
// so it is the one thing that most needs the smoothing. Hence the signature
// below takes a Snapshot and has no access to the Player's raw x/y.

import {
  CAM_ANCHOR_FRAC,
  CAM_K_CUBE,
  CAM_LOOKAHEAD_S,
  CAM_RISE_TILES,
  GROUND_BAND_TILES,
  TILE,
  VIEW_TILES,
  expSmooth,
} from "../engine/constants.ts";
import type { Player } from "../engine/player.ts";
import type { World } from "../engine/world.ts";
import type { Palette } from "../engine/palette.ts";
import type { Effects } from "./effects.ts";
import { ModePortal, Portal } from "../engine/objects/portals.ts";
import { Coin } from "../engine/objects/coin.ts";
import { Pad } from "../engine/objects/boosts.ts";
import { Ring } from "../engine/objects/boosts.ts";
import { drawBlock, drawCoin, drawCube, drawPad, drawPortal, drawRing, drawShip, drawSpike } from "./sprites.ts";

const COLORS = {
  skyTop: "#1E6BFF",
  skyBottom: "#4E9BFF",
  ground: "#0B2A8A",
  groundDeep: "#071E63",
  groundLine: "#FFFFFF",
  block: "#0A0A1E",
  blockEdge: "#FFFFFF",
  spike: "#0A0A1E",
  spikeEdge: "#FFFFFF",
  player: "#3BE86B",
  playerEdge: "#0A0A1E",
  ship: "#3BE86B",
  shipHull: "#FFD400",
  shipTrim: "#C98A00",
  portalShip: "#FF4FD8",
  portalCube: "#22DD55",
  portalGravity: "#FF9500",
  portalSize: "#00E5FF",
  portalSpeed: "#B36BFF",
  pad: "#FFD400",
  ring: "#FFD400",
  pit: "#06122C",
  hudBack: "rgba(6, 18, 60, 0.55)",
  hudFill: "#3BE86B",
  hudText: "#FFFFFF",
  checkpoint: "#00E5FF",
  hitPlayer: "#00FF6A",
  hitKill: "#FF2D2D",
  hitHazard: "#FFEE00",
} as const;

export type Camera = { x: number; y: number };

/**
 * How much world fits on screen, and the zoom that achieves it.
 *
 * The viewport is defined in world units first (VIEW_TILES rows tall) and the
 * scale falls out of that, rather than the other way round — so a wide monitor
 * sees further ahead but never further *up*, and the vertical challenge is
 * identical on every screen.
 */
export function viewport(viewW: number, viewH: number) {
  const scale = viewH / (VIEW_TILES * TILE);
  return { scale, vw: viewW / scale, vh: viewH / scale };
}

export function createCamera(world: World): Camera {
  return { x: -TILE * 4, y: world.spawn.y };
}

/**
 * Keep the view inside the level's declared borders.
 *
 * The camera's TARGET always comes from the player and nothing else; this only
 * stops the view running past a border the level actually declares. Two cases,
 * from one rule:
 *
 *   bounded, and the band fits the viewport
 *       -> nothing to scroll to, so the view sits still at the band's centre.
 *          This is what makes a ship corridor static: GD's ship gamemode has
 *          top and bottom borders by default, and a 10-tile corridor inside an
 *          11-tile viewport has nowhere to go.
 *   otherwise
 *       -> clamp, so the player is followed but a border is never crossed.
 *
 * In an OPEN section the ceiling is Infinity and only the ground floor applies,
 * so the camera simply follows the player upward. It cannot wander into blank
 * sky because the player cannot get there.
 */
function clampCamY(y: number, vh: number, world: World, x: number): number {
  const { floor, ceiling } = world.playBounds(x);
  const low = floor - GROUND_BAND_TILES * TILE;

  if (Number.isFinite(ceiling)) {
    const band = ceiling - low;
    if (band <= vh) return (ceiling + low) / 2;
    return Math.max(low + vh / 2, Math.min(ceiling - vh / 2, y));
  }
  return Math.max(low + vh / 2, y);
}

/**
 * Where the camera sits while the player is anywhere inside the resting band —
 * that is, during ordinary play. Framed off the floor, not off the player.
 */
function restingCamY(world: World, x: number, vh: number): number {
  const { floor, ceiling } = world.playBounds(x);
  const low = floor - GROUND_BAND_TILES * TILE;
  if (Number.isFinite(ceiling) && ceiling - low <= vh) return (ceiling + low) / 2;
  return low + vh / 2;
}

export type Snapshot = { x: number; y: number; rot: number };

/**
 * Blend the previous fixed step toward the current one.
 *
 * Everything visual downstream — camera included — consumes this rather than
 * the Player, which is what keeps the world scrolling smoothly between steps.
 */
export function interpolate(prev: Snapshot, p: Player, alpha: number): Snapshot {
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  return {
    x: prev.x + (p.x - prev.x) * a,
    y: prev.y + (p.y - prev.y) * a,
    rot: prev.rot + (p.rot - prev.rot) * a,
  };
}

/**
 * Where the camera wants to be, given the player and the level.
 *
 * Shared by snapCamera and updateCamera deliberately. They used to compute this
 * separately, and snapCamera never consulted the section anchor — so respawning
 * inside a ship section put the view back at the floor while the section is
 * composed around the portal, hiding everything in the upper half.
 */
function desiredCamY(p: Player, viewY: number, world: World, vh: number, x: number): number {
  if (p.def.camera === "anchored" && p.sectionAnchorY !== null) return p.sectionAnchorY;
  if (p.def.camera === "free" || p.def.camera === "anchored") {
    return viewY + p.vy * CAM_LOOKAHEAD_S;
  }
  const rest = restingCamY(world, x, vh);
  const { floor } = world.playBounds(x);
  const bandTop = floor + CAM_RISE_TILES * TILE;
  if (viewY > bandTop) return rest + (viewY - bandTop);
  if (viewY < floor) return rest + (viewY - floor);
  return rest;
}

/** Snap straight to the player, with no easing — used on spawn and respawn. */
export function snapCamera(
  cam: Camera,
  p: Player,
  world: World,
  viewW: number,
  viewH: number,
): void {
  const { vw, vh } = viewport(viewW, viewH);
  cam.x = p.x - vw * CAM_ANCHOR_FRAC;
  cam.y = clampCamY(desiredCamY(p, p.y, world, vh, p.x), vh, world, p.x);
}

/**
 * Move the camera for one frame.
 *
 * ONE rule, for every gamemode:
 *
 *   the player is within CAM_RISE_TILES of the floor  ->  the camera does not
 *                                                          move at all
 *   the player is above that                          ->  the camera follows
 *                                                          the excess, 1:1
 *
 * So jumping, landing, and hopping small steps move the view by nothing, and
 * the camera only travels once the player is genuinely climbing — about two and
 * a half stacked jumps up.
 *
 * The target is a CONTINUOUS function of the player's height: flat inside the
 * band, linear outside it, with no jump at the boundary. That is what removes
 * the jerkiness. The previous version tracked the last surface landed on, and
 * that target teleported on every landing, so the easing was permanently
 * chasing a step change.
 */
export function updateCamera(
  cam: Camera,
  p: Player,
  view: Snapshot,
  world: World,
  viewW: number,
  viewH: number,
  dt: number,
): void {
  const { vw, vh } = viewport(viewW, viewH);
  // Interpolated, not p.x. See the note at the top of this file.
  cam.x = view.x - vw * CAM_ANCHOR_FRAC;

  const rest = restingCamY(world, view.x, vh);
  const { floor } = world.playBounds(view.x);

  const desired = desiredCamY(p, view.y, world, vh, view.x);

  cam.y = clampCamY(expSmooth(cam.y, desired, p.def.cameraK || CAM_K_CUBE, dt), vh, world, view.x);
}

export type DrawInfo = {
  /**
   * The level's current colours, from its own colour triggers.
   *
   * Passed in rather than read from the simulation, so the renderer still has
   * no handle on simulation state and cannot affect it.
   */
  palette: Palette;
  percent: number;
  attempt: number;
  practice: boolean;
  checkpoints: { x: number; y: number }[];
  showHitboxes: boolean;
  /** Death debris. Presentation only — the simulation never sees it. */
  effects?: Effects;
  /** True while the player is dead, so the debris stands in for the icon. */
  hidePlayer?: boolean;
  /** Coin indices taken this attempt, so collected ones draw dimmed. */
  coins?: ReadonlySet<number>;
};

export function draw(
  ctx: CanvasRenderingContext2D,
  p: Player,
  view: Snapshot,
  world: World,
  cam: Camera,
  viewW: number,
  viewH: number,
  info: DrawInfo,
): void {
  const { x: px, y: py, rot: prot } = view;

  // Draw the world zoomed, then restore before the HUD so text stays crisp and
  // sized in real pixels rather than scaling with the window.
  const { scale, vw, vh } = viewport(viewW, viewH);
  ctx.save();
  ctx.scale(scale, scale);

  const sx = (wx: number) => wx - cam.x;
  const sy = (wy: number) => vh / 2 - (wy - cam.y);

  // ── sky ──────────────────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, info.palette.css("bg", 0.82));
  grad.addColorStop(1, info.palette.css("bg", 1.18));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);

  // Parallax rules, so speed reads even across empty stretches.
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const par = cam.x * 0.35;
  for (let gx = Math.floor(par / 120) * 120; gx < par + vw + 120; gx += 120) {
    const x = Math.round(gx - par) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, vh);
  }
  ctx.stroke();

  const lo = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const hi = Math.min(world.columns.length - 1, Math.floor((cam.x + vw) / TILE) + 1);

  // ── ground ───────────────────────────────────────────────────────────────
  // Iterate the full visible span rather than only the columns that exist, and
  // fall back to the level's base ground outside them. Otherwise the world ends
  // in a cliff at x=0 and again past the finish line, which reads as a bug.
  const gLo = Math.floor(cam.x / TILE) - 1;
  const gHi = Math.floor((cam.x + vw) / TILE) + 1;
  const colAt = (gx: number) => world.columns[gx] ?? world.columns[Math.max(0, Math.min(world.columns.length - 1, gx))];

  for (let gx = gLo; gx <= gHi; gx++) {
    const col = colAt(gx);
    if (!col) continue;
    const top = sy(col.groundY);
    if (top >= vh) continue;
    const gGrad = ctx.createLinearGradient(0, top, 0, vh);
    gGrad.addColorStop(0, info.palette.css("ground", 1.15));
    gGrad.addColorStop(1, info.palette.css("ground", 0.62));
    ctx.fillStyle = gGrad;
    ctx.fillRect(sx(gx * TILE), top, TILE + 1, vh - top);
  }
  ctx.strokeStyle = COLORS.groundLine;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let gx = gLo; gx <= gHi; gx++) {
    const col = colAt(gx);
    if (!col) continue;
    ctx.moveTo(sx(gx * TILE), sy(col.groundY));
    ctx.lineTo(sx((gx + 1) * TILE), sy(col.groundY));
  }
  ctx.stroke();

  // Ceiling, where a zone defines one (ship corridors).
  ctx.beginPath();
  for (let gx = lo; gx <= hi; gx++) {
    const col = world.columns[gx];
    if (!col || !Number.isFinite(col.ceilingY)) continue;
    ctx.moveTo(sx(gx * TILE), sy(col.ceilingY));
    ctx.lineTo(sx((gx + 1) * TILE), sy(col.ceilingY));
  }
  ctx.stroke();

  // Pits: flat dark notches set into the ground and ceiling lines. These used to
  // be drawn as spike triangles, which put hundreds of fake spikes across the
  // level and buried the real ones.
  ctx.fillStyle = info.palette.css("ground", 0.45);
  for (let gx = lo; gx <= hi; gx++) {
    for (const decor of world.columns[gx]?.decor ?? []) {
      const d = decor.cell;
      ctx.fillRect(sx(d.x), sy(d.y + d.h), d.w, d.h);
    }
  }

  // ── geometry ─────────────────────────────────────────────────────────────
  const drawn = new Set<string>();
  for (let gx = lo; gx <= hi; gx++) {
    const col = world.columns[gx];
    if (!col) continue;

    for (const block of col.solids) {
      const r = block.box;
      const key = `s${r.x},${r.y}`;
      if (drawn.has(key)) continue;
      drawn.add(key);
      drawBlock(ctx, sx(r.x), sy(r.y + r.h), r.w, r.h);
    }

    for (const hz of col.hazards) {
      const key = `h${hz.cell.x},${hz.cell.y},${hz.rot}`;
      if (drawn.has(key)) continue;
      drawn.add(key);

      // Positioned here, shaped in sprites.ts. Drawn from the CELL and rotated,
      // never derived from the lethal rect: the kill box is 6x12 and sits low
      // in the cell, so building the triangle from it put every spike in the
      // wrong place, at the wrong size, always pointing up.
      ctx.save();
      ctx.translate(sx(hz.cell.x + hz.cell.w / 2), sy(hz.cell.y + hz.cell.h / 2));
      // Hazard rotation is authored clockwise in the level file, matching the
      // source game's own convention, so it is applied to the y-down canvas
      // directly rather than through the world-space flip above.
      ctx.rotate((hz.rot * Math.PI) / 180);
      drawSpike(ctx, hz.cell.w, hz.cell.h);
      ctx.restore();
    }

    for (const t of col.triggers) {
      const key = `t${t.id}`;
      if (drawn.has(key)) continue;
      drawn.add(key);
      const x = sx(t.box.x);
      const y = sy(t.box.y + t.box.h);
      // One branch per family, each delegating to a sprite. A new trigger type
      // renders correctly as soon as it has a sprite — no edit here.
      if (t instanceof Portal) {
        const kind = t instanceof ModePortal ? t.mode : t.portalKind;
        drawPortal(ctx, x, y, t.box.w, t.box.h, kind);
      } else if (t instanceof Pad) {
        drawPad(ctx, x, y, t.box.w, t.box.h, t.color);
      } else if (t instanceof Ring) {
        drawRing(ctx, x, y, t.box.w, t.box.h, t.color);
      } else if (t instanceof Coin) {
        drawCoin(
          ctx,
          sx(t.cell.x),
          sy(t.cell.y + t.cell.h),
          t.cell.w,
          t.cell.h,
          info.coins?.has(t.index) ?? false,
        );
      }
    }
  }

  // ── practice checkpoints ─────────────────────────────────────────────────
  for (const cp of info.checkpoints) {
    const x = sx(cp.x);
    if (x < -40 || x > vw + 40) continue;
    ctx.strokeStyle = COLORS.checkpoint;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, vh);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.checkpoint;
    ctx.beginPath();
    ctx.arc(x, sy(cp.y), 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Attempt counter, pinned in the world at the level's start rather than
  // stapled to the screen — so it scrolls out of view once you are moving.
  {
    const ax = sx(world.spawn.x + TILE * 5);
    if (ax > -300 && ax < vw + 300) {
      ctx.fillStyle = COLORS.hudText;
      // Divided by the zoom: this is drawn inside the scaled world transform,
      // so a fixed pixel size would balloon on tall viewports where the scale
      // is large. Dividing keeps it a constant size on screen.
      ctx.font = `700 ${Math.round(30 / scale)}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`Attempt ${info.attempt}`, ax, sy(TILE * 6));
    }
  }

  // ── player ───────────────────────────────────────────────────────────────
  const box = p.box();
  ctx.save();
  ctx.translate(sx(px), sy(py));
  // Canvas y grows downward, so a positive angle here is clockwise on screen —
  // which is the direction the cube actually spins when moving right.
  // The ONE place world rotation becomes screen rotation. World space is y-up
  // and counter-clockwise positive; the canvas is y-down, so the sign flips
  // here for every mode at once.
  ctx.rotate(-prot);

  if (!info.hidePlayer) {
    if (p.mode === "ship") drawShip(ctx, box.w, box.h);
    else drawCube(ctx, box.w, box.h);
  }
  ctx.restore();

  // Debris last in world space, so it sits over the geometry it was blown off.
  info.effects?.draw(ctx, sx, sy);

  // ── hitbox overlay ───────────────────────────────────────────────────────
  // Bright, saturated, and drawn last so nothing paints over it. The earlier
  // version used muted site colours against a brown background and was
  // effectively invisible, which defeats the entire point of the toggle.
  if (info.showHitboxes) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.hitHazard;
    for (let gx = lo; gx <= hi; gx++) {
      const col = world.columns[gx];
      if (!col) continue;
      for (const hz of col.hazards) ctx.strokeRect(sx(hz.box.x), sy(hz.box.y + hz.box.h), hz.box.w, hz.box.h);
      for (const b of col.solids) ctx.strokeRect(sx(b.box.x), sy(b.box.y + b.box.h), b.box.w, b.box.h);
    }
    // Both player hitboxes, so the two-box model is visible while tuning:
    // green = the main 30x30 box that spikes are tested against,
    // red    = the small centre box that decides whether a wall kills you.
    const kill = p.box("lethal");
    ctx.strokeStyle = COLORS.hitPlayer;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx(kill.x), sy(kill.y + kill.h), kill.w, kill.h);
    const solid = p.box("solid");
    ctx.strokeStyle = COLORS.hitKill;
    ctx.strokeRect(sx(solid.x), sy(solid.y + solid.h), solid.w, solid.h);
  }

  ctx.restore();

  // ── HUD, inside the canvas ───────────────────────────────────────────────
  // In the level, not stapled to the page above it — so it survives fullscreen
  // and reads the way the real game's does.
  const barW = viewW * 0.5;
  const barX = (viewW - barW) / 2;
  const barY = 14;
  const barH = 16;

  ctx.fillStyle = COLORS.hudBack;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = COLORS.hudFill;
  ctx.fillRect(barX + 2, barY + 2, Math.max(0, (barW - 4) * (info.percent / 100)), barH - 4);
  ctx.strokeStyle = COLORS.hudText;
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = COLORS.hudText;
  ctx.font = "700 15px Arial, Helvetica, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(`${info.percent}%`, viewW / 2, barY + barH + 14);

  // The attempt counter is NOT part of the HUD — see the world-space draw
  // above. It sits at the level's start like the real game, and scrolls away
  // with everything else once the run is under way.

  if (info.practice) {
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.checkpoint;
    ctx.fillText("PRACTICE", viewW - 14, barY + barH / 2);
  }
}
