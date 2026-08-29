// One-shot sound effects.
//
// Separate from the music because the lifecycles are different: the track is a
// single element that pauses and resumes with the run, while an effect may need
// to fire again before the previous one has finished. Each effect therefore
// keeps a small pool of elements and cycles through them.

export type Sfx = {
  play: (name: "explode") => void;
  setMuted: (m: boolean) => void;
  unlock: () => void;
};

/**
 * Two encodings per effect.
 *
 * The source clip is Ogg Vorbis, which Safari does not decode. AAC in an MP4
 * container is picked first where it plays, with the Ogg as the fallback for
 * anything that prefers it — so the effect is audible everywhere rather than
 * silently missing on one browser.
 */
const SOURCES = {
  explode: ["/audio/explode.m4a", "/audio/explode.ogg"],
} as const;
const TYPES: Record<string, string> = {
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
};
const VOICES = 3;

/** First source this browser claims it can play, else the first listed. */
function pickSource(candidates: readonly string[]): string {
  if (typeof document === "undefined") return candidates[0];
  const probe = document.createElement("audio");
  for (const src of candidates) {
    const type = TYPES[src.slice(src.lastIndexOf("."))];
    if (type && probe.canPlayType(type)) return src;
  }
  return candidates[0];
}

export function createSfx(): Sfx {
  let muted = false;
  const pools = new Map<string, { els: HTMLAudioElement[]; next: number }>();

  function pool(name: keyof typeof SOURCES) {
    let p = pools.get(name);
    if (!p) {
      const src = pickSource(SOURCES[name]);
      p = {
        els: Array.from({ length: VOICES }, () => {
          const a = new Audio(src);
          a.preload = "auto";
          a.volume = 0.55;
          return a;
        }),
        next: 0,
      };
      pools.set(name, p);
    }
    return p;
  }

  return {
    play(name) {
      if (muted) return;
      const p = pool(name);
      const el = p.els[p.next];
      p.next = (p.next + 1) % p.els.length;
      try {
        el.currentTime = 0;
        void el.play().catch(() => {});
      } catch {
        // A seek can throw if the clip has not loaded yet. Losing one effect is
        // not worth interrupting the run over.
      }
    },
    setMuted(m) {
      muted = m;
      for (const p of pools.values()) for (const el of p.els) el.volume = m ? 0 : 0.55;
    },
    /** Prime the pool inside the Play click, while a user gesture is active. */
    unlock() {
      pool("explode");
    },
  };
}
