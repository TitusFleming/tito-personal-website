# Clubstep — level specification

Ground truth is the game's own shipped level file
(`Geometry Dash.app/Contents/Resources/levels/14.txt`), imported by
`scripts/import-gd-level.mjs` with `gd-objects.json`. Adherence is asserted by
`engine/clubstep.test.ts`.

## Identity

| fact | value |
|---|---|
| game position | official level 14 (update 1.6), the first demon |
| song | "Clubstep" by DJ-Nate |
| length | 887 tiles of content, end wall at x=888 (≈85.4 s at 1x) |
| start | cube, 1x speed, normal size, normal gravity |
| secret coins | 3 |

## Mode / size / gravity timeline

Constant 1x speed (speed portals are 1.7-era ids; none in this file). The
mini/normal identities of portal ids 99/101 were verified against the game's
own texture atlas: portal_08 (id 99) is the green size-normal portal,
portal_09 (id 101) the pink mini portal.

| x (tiles) | % | event |
|---|---|---|
| 0 | 0 | cube |
| 166 / 187 / 206.5 | 19–23 | gravity flips (up, up, up) in cube |
| 211.5 / 216.25 | 24 | down, up |
| 232 | 26.2 | **ship** (high corridor, portal y=645px) |
| 250 / 268 / 287 | 28–32 | gravity up / down / up in ship |
| 304 | 34.3 | cube |
| 326 | 36.8 | **mini** — stays mini through ball, UFO, ship |
| 389 | 43.9 | **ball** (mini) |
| 466.5 | 52.6 | **UFO** (mini) + gravity down |
| 505 | 57.0 | ship (mini) |
| 524.25 / 524.75 | 59.1 | cube + **normal size** |
| 547 / 550 / 556 | 62–63 | gravity down / up / down chain (cube) |
| 582 | 65.6 | ship + **mini** |
| 598 | 67.4 | gravity up (ship) |
| 614.75 | 69.3 | **UFO** (mini) + gravity down — coin 2 section |
| 661.5 | 74.6 | ship (mini) + gravity down |
| 719 / 725 / 732 | 81–83 | gravity up / down / up (ship) |
| 738 | 83.2 | cube + **normal size** + gravity down |
| 753 / 753.25 | 84.9 | **mini** + gravity up — inverted mini cube |
| 768.5 | 86.6 | ship (mini) |
| 779.25 / 786.75 | 88–89 | gravity down / up (ship) |
| 816 | 92.0 | cube (mini) + gravity down |
| 850.75 | 95.9 | ship (mini) to the end |
| 888 | 100 | end |

## Objects that must exist

| kind | count | detail |
|---|---|---|
| solid block cells | 3,837 | merged to 754 spans; includes 1,624 cells from the legacy 1.3–1.6 block ids (69–75, 91–96, 119, 161–169, 193) that are unlisted in the modern editor — identified via the Library of Geometria legacy-id mapping and the binary sprite dump |
| spikes | 569 | ids 8 (89), 39 (45), 103 (72), 177–179 (363), … |
| saws (circular hazards) | 139 | ids 88 (30, r=32.3px), 89 (28, r=21.6), 98 (4, r=12), 183 (12, r=15.48), 184 (3, r=20.4), 185 (4, r=3), 186 (54, r=32.3), 187 (4, r=21.96) — kill area is a circle, radii from the game's object-radius data |
| ground pits (non-lethal) | 771 | id 61 |
| pads | 32 | 9 yellow, 7 pink (id 140), 16 blue (id 67) |
| orbs | 124 | 40 yellow (36), 22 pink (141), 62 blue (84) |
| secret coins | 3 | grid (89, 3), (638.5, 19), (869, 2) |
| colour triggers | 96 | 95 background + 1 ground |
| fake spikes | 281 | ids 191/198/199 — decoration that only looks lethal; must NOT kill |

## Palette

Header colours are black on black — kS29 = kS30 = (0,0,0) — with an immediate
background fade to dark red (180,0,24) over 2 s at x=0.5. The 95 background
triggers pulse the level to the music (e.g. x=36.1 flash to (224,0,29) with
fade 0, back to (180,0,24) at 37.1), passing through dark green (0,182,44),
black, and red phases. The ground is recoloured once. A black-on-black level
must still render legibly (structure keeps its own edge colours).

## Physics the layout depends on

- Mini scales: hitbox 0.6, jump ×0.8, flying accel and clamps ÷0.85 — most of
  the level (37–59% and 66–100%) is played mini.
- Ball: gravity 0.6 g, tap = flip + 0.6 × jump launch, only while grounded.
- UFO: tap sets vy to 8×0.85 units (mini), asymmetric gravity.
- Gravity portals halve vy on flip — the 62–63% and 81–83% portal chains are
  built around it.
- Inverted cube (84.9–86.6%, mini) lands on block UNDERSIDES; collision must
  be gravity-aware.
- Blue orbs (×62) flip gravity with the −1.37 Y-speed launch; pink orbs (×22)
  launch at 1.37 (≈0.72 × jump).

## Non-goals (documented, deliberately not simulated)

- 2,000 decoration objects (chains, pillars, 1.6 filler; includes the 281
  fake spikes) — classified but not rendered.
- Transition triggers 23/24/26/27/28 (screen wipes) and the Obj colour
  trigger (id 105, ×8) — the latter tints decoration we do not render.
- Real Clubstep requires 10 secret coins to unlock and awards 10 stars;
  meta-progression is out of scope.
