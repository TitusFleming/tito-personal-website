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

import {
  CAM_ANCHOR_FRAC,
  CAM_K_CUBE,
  CAM_K_SHIP,
  CAM_Y_DEADZONE_FRAC,
  CAM_Y_OFFSET_FRAC,
  CAM_LOOKAHEAD_S,
  TILE,
  VIEW_TILES,
  WORLD_TOP_TILES,
  expSmooth,
} from "../engine/constants.ts";
import { playerBox, playerHazardBox, playerSolidBox } from "../engine/collision.ts";
import type { CompiledLevel, SimState } from "../engine/types.ts";

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

export type Camera = {
  x: number;
  y: number;
  /**
   * The surface height the camera is tracking in cube mode.
   *
   * This is the whole trick: in cube mode the camera follows the GROUND the
   * player last stood on, not the player. A jump is a 2-tile arc several times a
   * second, and following that makes the whole screen bob constantly. Anchoring
   * to the last landing means an ordinary jump moves nothing, and the view only
   * shifts when you actually reach a different level of the world.
   */
  anchorY: number;
};

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

export function createCamera(level: CompiledLevel): Camera {
  return { x: -TILE * 4, y: level.spawn.y, anchorY: level.spawn.y };
}

/** Snap the camera straight to the player, with no easing — used on spawn and respawn. */
/** Never look above the level's ceiling, and never below the ground. */
function clampCamY(y: number, vh: number): number {
  const top = WORLD_TOP_TILES * TILE - vh / 2;
  const bottom = vh / 2 - TILE * 2;
  return Math.max(bottom, Math.min(top, y));
}

export function snapCamera(cam: Camera, s: SimState, viewW: number, viewH: number): void {
  const { vw, vh } = viewport(viewW, viewH);
  cam.x = s.x - vw * CAM_ANCHOR_FRAC;
  cam.anchorY = s.y;
  cam.y = clampCamY(s.y + vh * CAM_Y_OFFSET_FRAC, vh);
}

export function updateCamera(
  cam: Camera,
  s: SimState,
  viewW: number,
  viewH: number,
  dt: number,
): void {
  const { vw, vh } = viewport(viewW, viewH);
  cam.x = s.x - vw * CAM_ANCHOR_FRAC;

  // What the camera is actually tracking.
  //
  // Cube: the last surface stood on. Jumping does not move the camera at all,
  // which is what the real game does — the view only shifts once you land
  // somewhere genuinely higher or lower. Falling is the one exception: if you
  // are dropping a long way there is no "last ground" worth holding onto, so
  // the camera starts following you down.
  //
  // Ship: the player directly, led by velocity, because there is no ground to
  // anchor to and the whole mode is vertical movement.
  let desired: number;
  if (s.mode === "cube") {
    if (s.onGround) cam.anchorY = s.y;
    else if (s.y < cam.anchorY - TILE * 3) cam.anchorY = s.y + TILE * 3;
    desired = cam.anchorY + vh * CAM_Y_OFFSET_FRAC;
  } else {
    desired = s.y + vh * CAM_Y_OFFSET_FRAC + s.vy * CAM_LOOKAHEAD_S;
  }

  const band = vh * CAM_Y_DEADZONE_FRAC;
  const k = s.mode === "ship" ? CAM_K_SHIP : CAM_K_CUBE;
  let target = cam.y;
  if (desired > cam.y + band) target = desired - band;
  else if (desired < cam.y - band) target = desired + band;
  cam.y = clampCamY(expSmooth(cam.y, target, k, dt), vh);
}

export type Snapshot = { x: number; y: number; rot: number };

export type DrawInfo = {
  percent: number;
  attempt: number;
  practice: boolean;
  checkpoints: { x: number; y: number }[];
  showHitboxes: boolean;
};

export function draw(
  ctx: CanvasRenderingContext2D,
  s: SimState,
  prev: Snapshot,
  level: CompiledLevel,
  cam: Camera,
  alpha: number,
  viewW: number,
  viewH: number,
  info: DrawInfo,
): void {
  const px = prev.x + (s.x - prev.x) * alpha;
  const py = prev.y + (s.y - prev.y) * alpha;
  const prot = prev.rot + (s.rot - prev.rot) * alpha;

  // Draw the world zoomed, then restore before the HUD so text stays crisp and
  // sized in real pixels rather than scaling with the window.
  const { scale, vw, vh } = viewport(viewW, viewH);
  ctx.save();
  ctx.scale(scale, scale);

  const sx = (wx: number) => wx - cam.x;
  const sy = (wy: number) => vh / 2 - (wy - cam.y);

  // ── sky ──────────────────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, COLORS.skyTop);
  grad.addColorStop(1, COLORS.skyBottom);
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
  const hi = Math.min(level.columns.length - 1, Math.floor((cam.x + vw) / TILE) + 1);

  // ── ground ───────────────────────────────────────────────────────────────
  // Iterate the full visible span rather than only the columns that exist, and
  // fall back to the level's base ground outside them. Otherwise the world ends
  // in a cliff at x=0 and again past the finish line, which reads as a bug.
  const gLo = Math.floor(cam.x / TILE) - 1;
  const gHi = Math.floor((cam.x + vw) / TILE) + 1;
  const colAt = (gx: number) => level.columns[gx] ?? level.columns[Math.max(0, Math.min(level.columns.length - 1, gx))];

  for (let gx = gLo; gx <= gHi; gx++) {
    const col = colAt(gx);
    if (!col) continue;
    const top = sy(col.groundY);
    if (top >= vh) continue;
    const gGrad = ctx.createLinearGradient(0, top, 0, vh);
    gGrad.addColorStop(0, COLORS.ground);
    gGrad.addColorStop(1, COLORS.groundDeep);
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
    const col = level.columns[gx];
    if (!col || !Number.isFinite(col.ceilingY)) continue;
    ctx.moveTo(sx(gx * TILE), sy(col.ceilingY));
    ctx.lineTo(sx((gx + 1) * TILE), sy(col.ceilingY));
  }
  ctx.stroke();

  // Pits: flat dark notches set into the ground and ceiling lines. These used to
  // be drawn as spike triangles, which put hundreds of fake spikes across the
  // level and buried the real ones.
  ctx.fillStyle = COLORS.pit;
  for (let gx = lo; gx <= hi; gx++) {
    for (const d of level.columns[gx]?.decor ?? []) {
      ctx.fillRect(sx(d.x), sy(d.y + d.h), d.w, d.h);
    }
  }

  // ── geometry ─────────────────────────────────────────────────────────────
  const drawn = new Set<string>();
  for (let gx = lo; gx <= hi; gx++) {
    const col = level.columns[gx];
    if (!col) continue;

    for (const r of col.solids) {
      const key = `s${r.x},${r.y}`;
      if (drawn.has(key)) continue;
      drawn.add(key);
      const x = sx(r.x);
      const y = sy(r.y + r.h);
      ctx.fillStyle = COLORS.block;
      ctx.fillRect(x, y, r.w, r.h);
      ctx.strokeStyle = COLORS.blockEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, r.w - 2, r.h - 2);
    }

    for (const hz of col.hazards) {
      const key = `h${hz.cell.x},${hz.cell.y},${hz.rot}`;
      if (drawn.has(key)) continue;
      drawn.add(key);

      // Drawn from the cell and rotated, NOT derived from the lethal rect. The
      // kill box is 6x12 and sits low in the cell, so building the triangle
      // from it put every spike in the wrong place, at the wrong size, always
      // pointing up — which is why ceiling spikes appeared under the floor.
      ctx.save();
      ctx.translate(sx(hz.cell.x + hz.cell.w / 2), sy(hz.cell.y + hz.cell.h / 2));
      ctx.rotate((hz.rot * Math.PI) / 180);
      const half = TILE / 2;
      ctx.fillStyle = COLORS.spike;
      ctx.beginPath();
      ctx.moveTo(-half + 1, half);
      ctx.lineTo(0, -half + 2);
      ctx.lineTo(half - 1, half);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COLORS.spikeEdge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    for (const t of col.triggers) {
      const key = `t${t.id}`;
      if (drawn.has(key)) continue;
      drawn.add(key);
      const x = sx(t.box.x);
      const y = sy(t.box.y + t.box.h);
      if (t.kind === "ship" || t.kind === "cube") {
        const c = t.kind === "ship" ? COLORS.portalShip : COLORS.portalCube;
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, y, t.box.w, t.box.h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = c;
        ctx.lineWidth = 4;
        ctx.strokeRect(x + 2, y + 2, t.box.w - 4, t.box.h - 4);
      } else if (t.kind === "pad") {
        ctx.fillStyle = COLORS.pad;
        ctx.fillRect(x + 2, y, t.box.w - 4, t.box.h);
      } else {
        ctx.strokeStyle = COLORS.ring;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x + t.box.w / 2, y + t.box.h / 2, TILE * 0.32, 0, Math.PI * 2);
        ctx.stroke();
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
    const ax = sx(level.spawn.x + TILE * 5);
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
  const box = playerBox(s);
  ctx.save();
  ctx.translate(sx(px), sy(py));
  // Canvas y grows downward, so a positive angle here is clockwise on screen —
  // which is the direction the cube actually spins when moving right.
  ctx.rotate(prot);

  if (s.mode === "ship") {
    // A small rounded craft with the cube riding on top, which is the shape the
    // real game uses — a bare triangle read as a paper dart.
    const hw = box.w / 2;
    const hh2 = box.h / 2;

    // tail fin
    ctx.fillStyle = COLORS.shipTrim;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.95, -hh2 * 0.2);
    ctx.lineTo(-hw * 1.25, -hh2 * 1.5);
    ctx.lineTo(-hw * 0.35, -hh2 * 0.5);
    ctx.closePath();
    ctx.fill();

    // hull: blunt tail, tapered nose, flat-ish underside
    ctx.fillStyle = COLORS.shipHull;
    ctx.strokeStyle = COLORS.playerEdge;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(hw * 1.15, 0);
    ctx.quadraticCurveTo(hw * 0.55, -hh2 * 1.15, -hw * 0.7, -hh2 * 0.95);
    ctx.quadraticCurveTo(-hw * 1.15, -hh2 * 0.75, -hw * 1.1, 0);
    ctx.quadraticCurveTo(-hw * 1.1, hh2 * 0.8, -hw * 0.55, hh2 * 0.95);
    ctx.quadraticCurveTo(hw * 0.5, hh2 * 1.0, hw * 1.15, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // cockpit glass
    ctx.fillStyle = COLORS.shipTrim;
    ctx.beginPath();
    ctx.ellipse(hw * 0.25, 0, hw * 0.42, hh2 * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // the rider, sitting on the hull
    const c = box.h * 1.05;
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(-c / 2, -hh2 - c + 2, c, c);
    ctx.fillStyle = COLORS.playerEdge;
    ctx.fillRect(-c / 2 + 4, -hh2 - c + 6, c - 8, c - 8);
    ctx.strokeStyle = COLORS.playerEdge;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-c / 2 + 1.25, -hh2 - c + 3.25, c - 2.5, c - 2.5);
  } else {
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(-box.w / 2, -box.h / 2, box.w, box.h);
    ctx.fillStyle = COLORS.playerEdge;
    ctx.fillRect(-box.w / 2 + 8, -box.h / 2 + 8, box.w - 16, box.h - 16);
    ctx.strokeStyle = COLORS.playerEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(-box.w / 2 + 1.5, -box.h / 2 + 1.5, box.w - 3, box.h - 3);
  }
  ctx.restore();

  // ── hitbox overlay ───────────────────────────────────────────────────────
  // Bright, saturated, and drawn last so nothing paints over it. The earlier
  // version used muted site colours against a brown background and was
  // effectively invisible, which defeats the entire point of the toggle.
  if (info.showHitboxes) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.hitHazard;
    for (let gx = lo; gx <= hi; gx++) {
      const col = level.columns[gx];
      if (!col) continue;
      for (const hz of col.hazards) ctx.strokeRect(sx(hz.box.x), sy(hz.box.y + hz.box.h), hz.box.w, hz.box.h);
      for (const r of col.solids) ctx.strokeRect(sx(r.x), sy(r.y + r.h), r.w, r.h);
    }
    // Both player hitboxes, so the two-box model is visible while tuning:
    // green = the main 30x30 box that spikes are tested against,
    // red    = the small centre box that decides whether a wall kills you.
    const kill = playerHazardBox(s);
    ctx.strokeStyle = COLORS.hitPlayer;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx(kill.x), sy(kill.y + kill.h), kill.w, kill.h);
    const solid = playerSolidBox(s);
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
