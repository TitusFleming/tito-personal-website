# Physics specification — what "1:1" means and where every number comes from

This engine's physics constants are conversions of the real game's decompiled
per-frame model. This file is the contract; `engine/constants.ts` implements
it; `engine/physics.test.ts` pins the observable behaviour.

## The unit model

Real GD integrates per 60 Hz frame in "units" (30 units = 1 block = 1 tile
here), and scales every physics step by its own 0.9 timescale
(`dtSlow = dt * 0.9`). Converting to this engine's continuous px/s:

| conversion | factor |
|---|---|
| velocity: 1 unit/frame | 54 px/s (0.9 × 60) |
| acceleration: 1 unit/frame² | 2916 px/s² (0.9² × 60²) |

Proof the model is right: GD's 1x horizontal speed is 5.77 units/frame
× 54 = **311.58 px/s**, exactly the long-established community speed figure.

## Sources

1. [camila314/gdp](https://github.com/camila314/gdp) — decompilation of the
   live 2.2 binary (`PlayerObject_updateJump.cpp`, `PlayerObject_boostPlayer.cpp`).
2. [Open-GD/OpenGD](https://github.com/Open-GD/OpenGD) — reverse-engineered
   recreation (`Source/PlayerObject.cpp`); exact constants `m_dGravity =
   0.958199`, `m_dJumpHeight = 11.180032`, the 0.9 timescale, ship states.
3. [GD Docs — player hitboxes](https://boomlings.dev/reference/player_physics/hitboxes)
   — outer box 30 units (mini 18), inner box 9, wave 10/3.
4. Per-object hitbox and radius dumps mirrored in
   `leafon5/neurondash/other/ref/{hitboxes,circleRadii}.json` (spike 6×12,
   orb 36×36, pad 25×4, saw radii).

## The constants, converted

| quantity | GD value (per frame) | engine value | file |
|---|---|---|---|
| gravity (cube & base) | 0.958199 | −2794.108 px/s² | `CUBE_GRAVITY` |
| jump velocity | 11.180032 | +603.72 px/s | `CUBE_JUMP_VY` |
| terminal fall (non-flying) | 15 | −810 px/s | `CUBE_TERMINAL_VY` |
| jump apex (derived) | 65.22 units | 2.174 tiles | test-pinned |
| jump airtime (derived) | — | 0.4321 s | `CUBE_AIRTIME` |
| ship hold (rising / diving) | 0.4 g / 0.5 g up | 1117.6 / 1397.1 px/s² | `SHIP_ACCEL` |
| ship release (rising / falling) | 0.48 g / 0.32 g down | 1341.2 / 894.1 px/s² | `SHIP_ACCEL` |
| flying rise / fall clamp | 8 / 6.4 | 432 / 345.6 px/s | `FLY_RISE_MAX/FALL` |
| ball gravity | 0.6 g | −1676.46 px/s² | `BALL_GRAVITY` |
| ball tap | flip + 0.6 × jump | 362.2 px/s | `BALL_TAP_VY` |
| UFO gravity (rising / falling) | 0.6 g / 0.4 g | −1676.5 / −1117.6 px/s² | `UFO_GRAVITY_*` |
| UFO tap (sets, never adds) | 7 (mini 8 × 0.85) | 378 / 367.2 px/s | `UFO_TAP_VY*` |
| mini jump scale | 0.8 | `MINI_JUMP_SCALE` | |
| mini flying scale | ÷0.85 on accel+clamps | `MINI_FLY_SCALE` | |
| mini hitbox | 18/30 units | 0.6 | `SIZE_MINI` |
| inner (solid) hitbox | 9/30 units | 0.3 | `SOLID_HITBOX_SCALE` |
| gravity flip | halves vy | `GravityPortal.onEnter` | |
| wave slope | vy = horizontal speed | 1 | `WAVE_SLOPE` |

Pads and orbs use the game's own Y-speed table (units of 5.77/frame =
311.58 px/s each): yellow pad 2.77, pink 1.79, red 3.65, blue −1.37; yellow
orb 1.91, pink 1.37, red 2.68, blue −1.37, green −1.91, black −2.6. Cross-check:
yellow pad 2.77 × 5.77 ≈ 16, OpenGD's literal `propellPlayer` force; yellow orb
≈ the jump velocity, OpenGD's default ring case.

## Known deliberate deviations

- The mini INNER hitbox is 10 units in the real game (bigger than normal's 9);
  here it scales down with the body. Mini wall-deaths are slightly kinder.
- Orb strengths follow the Y-speed table, which differs from OpenGD's
  multipliers by ≤2% (e.g. yellow orb 595 vs 604 px/s).
- The engine integrates at 240 Hz continuously rather than 60 Hz discretely;
  arcs match to sub-pixel but individual frame boundaries differ.
- Real GD buffers an orb press slightly before overlap; here a press must
  happen while overlapping (or be held on entry with the edge still armed).
