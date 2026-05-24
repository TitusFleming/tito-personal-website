"use client";

import { useState, useRef, useEffect } from "react";

type GDDLLevel = {
  id: number;
  name: string;
  creator: string;
  tierScore: number;
  showcase: string;
};

type Phase = "setup" | "loading" | "playing" | "result";

type FlashState = {
  harderSide: "left" | "right" | "tie";
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function scoreMessage(n: number) {
  if (n === 0) return "Better luck next time.";
  if (n < 5) return "A decent start.";
  if (n < 10) return "Getting there.";
  if (n < 20) return "Sharp eye.";
  if (n < 35) return "You really know your tiers.";
  return "Certified tier lord.";
}

function LevelCard({
  level,
  flash,
  side,
  onClick,
}: {
  level: GDDLLevel;
  flash: FlashState | null;
  side: "left" | "right";
  onClick: () => void;
}) {
  let cls = "gddl-card";
  if (flash) {
    if (flash.harderSide === "tie") cls += " gddl-card-tied";
    else if (flash.harderSide === side) cls += " gddl-card-harder";
    else cls += " gddl-card-easier";
  }
  return (
    <button className={cls} onClick={onClick} disabled={flash !== null}>
      <img
        className="gddl-card-thumb"
        src={`https://i.ytimg.com/vi/${level.showcase}/mqdefault.jpg`}
        alt={level.name}
        draggable={false}
      />
      <div className="gddl-card-body">
        <p className="gddl-card-name">{level.name}</p>
        <p className="gddl-card-creator">by {level.creator}</p>
        {flash && <p className="gddl-card-tier">T{level.tierScore?.toFixed(2) ?? "?"}</p>}
      </div>
    </button>
  );
}

export default function GDDLGame() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [tierMin, setTierMin] = useState(16);
  const [tierMax, setTierMax] = useState(20);
  const [activeMin, setActiveMin] = useState(16);
  const [activeMax, setActiveMax] = useState(20);
  const [pool, setPool] = useState<GDDLLevel[]>([]);
  const [leftCard, setLeftCard] = useState<GDDLLevel | null>(null);
  const [rightCard, setRightCard] = useState<GDDLLevel | null>(null);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  async function startGame(min = tierMin, max = tierMax) {
    const safeMin = isNaN(min) ? 1 : Math.max(1, Math.min(38, min));
    const safeMax = isNaN(max) || max <= safeMin ? safeMin + 1 : Math.min(39, max);
    if (timerRef.current) clearTimeout(timerRef.current);
    setError(null);
    setScore(0);
    setFlash(null);
    setActiveMin(safeMin);
    setActiveMax(safeMax);
    setPhase("loading");

    try {
      const res = await fetch(`/api/gddl?minTier=${safeMin}&maxTier=${safeMax}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to load levels");
      const levels = data.levels as GDDLLevel[];
      if (levels.length < 2) throw new Error("Not enough levels found — try a wider range");
      const shuffled = shuffle(levels);
      setLeftCard(shuffled[0]);
      setRightCard(shuffled[1]);
      setPool(shuffled.slice(2));
      setPhase("playing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("setup");
    }
  }

  function handlePick(side: "left" | "right") {
    if (!leftCard || !rightCard || flash !== null) return;

    const ls = Math.round(leftCard.tierScore * 100);
    const rs = Math.round(rightCard.tierScore * 100);
    const harderSide: "left" | "right" | "tie" =
      ls === rs ? "tie" : ls > rs ? "left" : "right";
    const isTie = harderSide === "tie";
    const isCorrect = isTie || harderSide === side;

    setFlash({ harderSide });

    timerRef.current = setTimeout(() => {
      setFlash(null);
      if (!isCorrect) { setPhase("result"); return; }
      setScore((s) => s + 1);
      const next = pool[0];
      if (!next) { setPhase("result"); return; }
      if ((isTie ? side : harderSide) === "left") setRightCard(next);
      else setLeftCard(next);
      setPool(pool.slice(1));
    }, 800);
  }

  if (phase === "setup") {
    return (
      <section className="pulse-shell">
        <div className="pulse-controls">
          <div>
            <p className="eyebrow">Tier range</p>
            <h2>Pick your difficulty</h2>
          </div>
          <div className="gddl-range-row">
            <label>
              <span>Min tier (1-38)</span>
              <input
                type="number"
                min={1}
                max={38}
                value={tierMin}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTierMin(v);
                  if (!isNaN(v) && v >= tierMax) setTierMax(v + 1);
                }}
              />
            </label>
            <label>
              <span>Max tier (2-39)</span>
              <input
                type="number"
                min={2}
                max={39}
                value={tierMax}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTierMax(v);
                  if (!isNaN(v) && v <= tierMin) setTierMin(v - 1);
                }}
              />
            </label>
            <button className="gddl-start-btn" onClick={() => startGame()}>
              Play
            </button>
          </div>
        </div>
        {error && <p className="gddl-error">{error}</p>}
      </section>
    );
  }

  if (phase === "loading") {
    return (
      <section className="pulse-shell">
        <p className="eyebrow">Loading levels</p>
        <div className="pulse-loading" />
      </section>
    );
  }

  if (phase === "result") {
    return (
      <section className="pulse-shell">
        <p className="eyebrow">Game over</p>
        <div className="gddl-result-score">{score}</div>
        <p className="lede">{scoreMessage(score)}</p>
        <p className="eyebrow" style={{ marginTop: "0.6rem" }}>
          T{activeMin} - T{activeMax}
        </p>
        <div className="gddl-result-actions">
          <button className="gddl-start-btn" onClick={() => startGame(activeMin, activeMax)}>
            Play again
          </button>
          <button className="gddl-ghost-btn" onClick={() => setPhase("setup")}>
            Change range
          </button>
        </div>
      </section>
    );
  }

  if (leftCard && rightCard) {
    return (
      <section className="pulse-shell">
        <div className="pulse-controls">
          <div>
            <p className="eyebrow">Score</p>
            <div className="score-number">{score}</div>
          </div>
          <div>
            <p className="eyebrow" style={{ color: "#fffaf0", textAlign: "right" }}>
              T{activeMin} - T{activeMax}
            </p>
          </div>
        </div>
        <div className="gddl-arena">
          <LevelCard level={leftCard} flash={flash} side="left" onClick={() => handlePick("left")} />
          <LevelCard level={rightCard} flash={flash} side="right" onClick={() => handlePick("right")} />
        </div>
        <p className="gddl-hint">Click the harder level</p>
      </section>
    );
  }

  return null;
}
