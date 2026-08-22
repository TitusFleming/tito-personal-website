// The level list.
//
// Adding a level is one entry here plus its imported JSON — nothing in the game
// component, the engine, or the renderer needs to change. Before this existed
// the level and its music were hardcoded in three separate places.

import stereoMadness from "./stereo-madness.json" with { type: "json" };
import backOnTrack from "./back-on-track.json" with { type: "json" };
import type { LevelDoc } from "../engine/types.ts";

export type LevelEntry = {
  readonly id: string;
  readonly name: string;
  /** Display order, matching the real game's. */
  readonly number: number;
  readonly doc: LevelDoc;
  /** Track for this level, or null to play silently. */
  readonly audio: string | null;
};

export const LEVELS: LevelEntry[] = [
  {
    id: "stereo-madness",
    name: "Stereo Madness",
    number: 1,
    doc: stereoMadness as LevelDoc,
    audio: "/audio/stereo-madness.mp3",
  },
  {
    id: "back-on-track",
    name: "Back on Track",
    number: 2,
    doc: backOnTrack as LevelDoc,
    audio: "/audio/back-on-track.mp3",
  },
];

export function levelById(id: string): LevelEntry {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}
