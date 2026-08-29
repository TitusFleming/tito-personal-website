// Level validation.
//
// Compilation moved to world.ts, which builds object instances. What is left
// here is the cheap structural check, kept pure and separate so the importer
// can report on a level without building one.

import { PLAYABLE_MODES, type GameMode } from "./modes/mode.ts";
import type { LevelDoc } from "./types.ts";

export { compileLevel, World, type Column } from "./world.ts";

export type LevelWarning = { severity: "error" | "warn"; message: string };

export function validateLevel(doc: LevelDoc): LevelWarning[] {
  const out: LevelWarning[] = [];
  const end = doc.objects.find((o) => o.t === "end");

  if (!end) out.push({ severity: "error", message: "No end marker." });
  if (doc.objects.some((o) => "x" in o && o.x < 0)) {
    out.push({ severity: "error", message: "Objects at negative x." });
  }

  // Mode portals, in play order. A ship section with no ceiling is unbounded,
  // which plays as an empty void.
  const isMode = (t: string): t is GameMode =>
    (["cube", "ship", "ball", "ufo", "wave"] as string[]).includes(t);

  const portals = doc.objects
    .filter((o): o is Extract<LevelObjectAny, { x: number }> => isMode(o.t) && "x" in o)
    .sort((a, b) => a.x - b.x);

  let mode = doc.startMode;
  for (const p of portals) {
    const next = p.t as GameMode;
    if (next === mode) {
      out.push({ severity: "warn", message: `Redundant ${next} portal at x=${p.x}.` });
    }
    if (!PLAYABLE_MODES.includes(next)) {
      out.push({
        severity: "warn",
        message: `Level uses "${next}" mode, which is implemented but not yet tuned against a real level.`,
      });
    }
    mode = next;
  }

  // A level may end in a flying mode with no zone ceiling: the mode portal
  // itself establishes the section's floor and ceiling (see ModePortal), so
  // the old "ship with no ceiling plays as an empty void" warning is obsolete
  // — and Clubstep, which genuinely ends in a ship, would trip it.

  return out;
}

type LevelObjectAny = LevelDoc["objects"][number];
