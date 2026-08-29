# Back on Track — level specification

Ground truth is the game's own shipped level file
(`Geometry Dash.app/Contents/Resources/levels/2.txt`, URL-safe base64 +
gzip), imported by `scripts/import-gd-level.mjs` using the object table
`gd-objects.json`. Every fact below is from that file unless cited otherwise.
Adherence is asserted by `engine/back-on-track.test.ts`.

## Identity

| fact | value |
|---|---|
| game position | official level 2 (update 1.0) |
| song | "Back On Track" by DJVI |
| length | 833 tiles of content, end wall at x=834 (≈80.3 s at 1x) |
| start | cube, 1x speed, normal size, normal gravity |
| secret coins | 3 |

## Mode timeline

Constant 1x speed throughout (speed portals did not exist in 1.0, and the
2.2 re-save adds none). One flying section:

| x (tiles) | % | event |
|---|---|---|
| 0 | 0 | cube |
| 348 | 41.8 | normal-gravity portal (no-op safety; no flip portal precedes it) |
| 421 | 50.6 | ship portal |
| 559 | 67.1 | cube portal |
| 834 | 100 | end |

## Objects that must exist

| kind | count | detail |
|---|---|---|
| solid block cells | 464 | merged to 260 spans |
| spikes | 149 | 130 full (id 8) + 19 half (id 39) |
| ground pits (non-lethal) | 370 | id 9 notches in the ground line |
| yellow pads | 19 | id 35 |
| blue (gravity) pad | 1 | id 67, x≈342.7 — bounces into the coin-1 drop |
| orbs | 0 | orbs enter the official levels later than 1.0 |
| secret coins | 3 | grid (351, 8), (466, 7), (711, 1.5) |
| colour triggers | 10 | 5 background + 5 ground |

## Palette timeline (kS29/kS30 + triggers 29/30)

| x (tiles) | background | ground | fade s |
|---|---|---|---|
| start | (255, 4, 181) | (226, 0, 138) | — |
| 140.5 | (252, 0, 131) | (167, 0, 89) | 0.5 |
| 355.5 | (253, 0, 34) | (138, 0, 9) | 10 |
| 421.5 | (130, 1, 255) | (74, 0, 144) | 0.5 |
| 559.5 | (255, 0, 172) | (179, 0, 110) | 0.5 |
| 701.5 | (0, 136, 254) | (0, 93, 196) | 0.3 |

## Physics the layout depends on

- Cube jump apex 2.174 tiles, airtime 0.432 s, reach ≈4.49 tiles at 1x
  (SPEC-physics.md) — the pad-and-platform rhythm sections assume them.
- Yellow pad launch 2.77 Y-speed units (≈863 px/s); the coin-1 route needs the
  blue pad's gravity flip with the halved-velocity rule.
- Ship section bounds come from the ship portal (10-tile section centred on
  the portal), not from scenery.

## Non-goals (documented, deliberately not simulated)

- 521 decoration objects (table type `deco`) — not rendered.
- Transition triggers 22/23/27 (screen-wipe effects for objects entering the
  view) — visual only in the real game.
- The mirror portal does not appear in this level; no work needed.
