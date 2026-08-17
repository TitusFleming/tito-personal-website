// The level's music.
//
// This plays the real Stereo Madness track (ForeverBound), served from
// public/audio. Worth knowing what that means: the track was released by Ultra
// Records, so unlike everything else in this project it is a licensed
// commercial recording rather than something generated or self-made. It is the
// one asset here that could attract a takedown on a personal domain. An earlier
// version synthesised a chiptune at the same 160 BPM to avoid that; this was a
// deliberate decision to use the real thing instead.
//
// Playback restarts from zero on every death, because the level is choreographed
// to the music — a run that begins mid-track has the beat in the wrong place and
// every jump cue lands wrong.

const SRC = "/audio/stereo-madness.mp3";

export type Music = {
  start: () => Promise<void>;
  restart: () => void;
  /** Hold the track where it is — the game is paused, not over. */
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setMuted: (m: boolean) => void;
};

export function createMusic(): Music {
  let el: HTMLAudioElement | null = null;
  let muted = false;

  function ensure(): HTMLAudioElement {
    if (!el) {
      el = new Audio(SRC);
      el.preload = "auto";
      el.loop = true;
      el.volume = muted ? 0 : 0.5;
    }
    return el;
  }

  return {
    async start() {
      const a = ensure();
      a.currentTime = 0;
      try {
        // Browsers reject play() until a real user gesture; this is called from
        // the click on Play, which is that gesture.
        await a.play();
      } catch {
        // Autoplay refused. The game is entirely playable without sound, so
        // this is not worth surfacing to the player.
      }
    },
    restart() {
      if (!el) return;
      el.currentTime = 0;
      // A paused element (tab was hidden, or autoplay was refused) should not
      // start blaring on a respawn, so only resume something already running.
      if (!el.paused) void el.play().catch(() => {});
    },
    pause() {
      el?.pause();
    },
    resume() {
      // Resume from where it stopped rather than restarting: pausing is not a
      // new attempt, so the music should pick up in sync with the level.
      if (el && el.paused) void el.play().catch(() => {});
    },
    stop() {
      if (!el) return;
      el.pause();
      el.currentTime = 0;
      el = null;
    },
    setMuted(m: boolean) {
      muted = m;
      if (el) el.volume = m ? 0 : 0.5;
    },
  };
}
