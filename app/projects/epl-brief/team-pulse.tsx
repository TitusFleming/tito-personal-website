"use client";

import { useEffect, useMemo, useState } from "react";

type TeamReport = {
  id: number;
  name: string;
  shortName: string;
  score: number;
  rank: number;
  mood: string;
  verdict: string;
  metrics: {
    matchesPlayed: number;
    recentPoints: number;
    pointsPerMatch: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    cleanSheets: number;
    attackStrength: number;
    defenceStrength: number;
    opponentAdjustment: number;
  };
  recentMatches: {
    id: number;
    opponent: string;
    venue: "H" | "A";
    result: "W" | "D" | "L";
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    date: string | null;
  }[];
};

type ApiResponse = {
  updatedAt: string;
  source: string;
  teams: TeamReport[];
};

const CHELSEA = "Chelsea";

function isApiResponse(value: ApiResponse | { error?: string }): value is ApiResponse {
  return "teams" in value && Array.isArray(value.teams);
}

function formatDate(value: string | null) {
  if (!value) return "Recent";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function scoreLabel(score: number) {
  if (score >= 80) return "Elite";
  if (score >= 65) return "Strong";
  if (score >= 45) return "Okay";
  if (score >= 30) return "Worrying";
  return "Bad";
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function matchScore(match: TeamReport["recentMatches"][number]) {
  const resultPoints = match.result === "W" ? 3 : match.result === "D" ? 1 : 0;
  return clamp(25 + resultPoints * 18 + match.goalDifference * 8 + match.goalsFor * 3 - match.goalsAgainst * 2);
}

function FormGraph({ matches }: { matches: TeamReport["recentMatches"] }) {
  const chronological = [...matches].reverse();
  const width = 640;
  const height = 260;
  const paddingX = 34;
  const paddingY = 28;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  const points = chronological.map((match, index) => {
    const x = paddingX + (chronological.length <= 1 ? 0 : (index / (chronological.length - 1)) * usableWidth);
    const y = paddingY + (1 - matchScore(match) / 100) * usableHeight;
    return { x, y, match, score: matchScore(match) };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath =
    points.length > 0
      ? `${path} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
      : "";

  return (
    <div className="form-graph" aria-label="Recent form graph">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Recent form graph</title>
        {[25, 50, 75].map((line) => (
          <line
            className="graph-grid-line"
            key={line}
            x1={paddingX}
            x2={width - paddingX}
            y1={paddingY + (1 - line / 100) * usableHeight}
            y2={paddingY + (1 - line / 100) * usableHeight}
          />
        ))}
        <path className="graph-area" d={areaPath} />
        <path className="graph-line" d={path} />
        {points.map((point) => (
          <g key={point.match.id}>
            <circle className={`graph-dot result-${point.match.result.toLowerCase()}-dot`} cx={point.x} cy={point.y} r="7" />
            <text className="graph-label" x={point.x} y={height - 8} textAnchor="middle">
              {point.match.result}
            </text>
          </g>
        ))}
      </svg>
      <div className="graph-caption">
        <span>Older</span>
        <span>Recent</span>
      </div>
    </div>
  );
}

export default function TeamPulse() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [selectedTeam, setSelectedTeam] = useState(CHELSEA);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const response = await fetch("/api/epl-brief", { cache: "no-store" });
        const json = (await response.json()) as ApiResponse | { error?: string };

        if (!response.ok || !isApiResponse(json)) {
          throw new Error("error" in json ? json.error : "Could not load team data");
        }

        if (!cancelled) {
          setData(json);
          if (!json.teams.some((team) => team.name === selectedTeam)) {
            setSelectedTeam(json.teams[0]?.name ?? CHELSEA);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load team data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [selectedTeam]);

  const selectedReport = useMemo(() => {
    if (!data) return null;
    return data.teams.find((team) => team.name === selectedTeam) ?? data.teams[0] ?? null;
  }, [data, selectedTeam]);

  if (loading) {
    return (
      <section className="pulse-shell">
        <p className="eyebrow">Loading live team data</p>
        <div className="pulse-loading" />
      </section>
    );
  }

  if (error || !data || !selectedReport) {
    return (
      <section className="pulse-shell">
        <p className="eyebrow">Data unavailable</p>
        <h2>Could not load the Premier League pulse.</h2>
        <p className="lede">{error || "Try refreshing in a minute."}</p>
      </section>
    );
  }

  return (
    <section className="pulse-shell" aria-label="Premier League team pulse">
      <div className="pulse-controls">
        <div>
          <p className="eyebrow">Team selector</p>
          <h2>{selectedReport.name}</h2>
        </div>
        <label>
          <span>Choose club</span>
          <select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
            {data.teams
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((team) => (
                <option key={team.id} value={team.name}>
                  {team.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="dashboard-grid">
        <article className="score-card dashboard-card">
          <div className="score-header">
            <div>
              <p className="eyebrow">Momentum score</p>
              <div className="score-number">{selectedReport.score}</div>
            </div>
            <div className="rank-pill">#{selectedReport.rank}</div>
          </div>
          <div className="score-bar" aria-hidden="true">
            <span style={{ width: `${selectedReport.score}%` }} />
          </div>
          <h2>{selectedReport.mood}</h2>
          <p>{scoreLabel(selectedReport.score)} recent-form profile.</p>
        </article>

        <article className="verdict-card dashboard-card">
          <p className="eyebrow">Readout</p>
          <h2>{selectedReport.verdict}</h2>
          <p>
            Score uses recent points, goal trend, goals for, goals against, clean sheets,
            and public FPL team strength.
          </p>
        </article>

        <article className="graph-card dashboard-card">
          <div className="section-heading">
            <p className="eyebrow">Form graph</p>
            <h2>Last five match pulse</h2>
          </div>
          <FormGraph matches={selectedReport.recentMatches} />
        </article>

        <article className="metrics-card dashboard-card">
          <p className="eyebrow">Factors</p>
          <div className="metric-grid">
            <article>
              <span>{selectedReport.metrics.recentPoints}</span>
              <p>points</p>
            </article>
            <article>
              <span>
                {selectedReport.metrics.goalDifference > 0 ? "+" : ""}
                {selectedReport.metrics.goalDifference}
              </span>
              <p>goal diff</p>
            </article>
            <article>
              <span>{selectedReport.metrics.goalsFor}</span>
              <p>goals for</p>
            </article>
            <article>
              <span>{selectedReport.metrics.goalsAgainst}</span>
              <p>against</p>
            </article>
            <article>
              <span>{selectedReport.metrics.cleanSheets}</span>
              <p>clean sheets</p>
            </article>
          </div>
        </article>
      </div>

      <div className="lower-grid">
        <div className="recent-panel">
          <div className="section-heading">
            <p className="eyebrow">Recent matches</p>
            <h2>Last five</h2>
          </div>
          <div className="match-strip">
            {selectedReport.recentMatches.map((match) => (
              <article className={`match-card result-${match.result.toLowerCase()}`} key={match.id}>
                <span>{match.result}</span>
                <h3>
                  {match.goalsFor}-{match.goalsAgainst}
                </h3>
                <p>
                  {match.venue} vs {match.opponent}
                </p>
                <small>{formatDate(match.date)}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="table-panel">
          <div className="section-heading">
            <p className="eyebrow">League pulse</p>
            <h2>All clubs</h2>
          </div>
          <div className="pulse-table">
            {data.teams.map((team) => (
              <button
                className={team.id === selectedReport.id ? "active" : ""}
                key={team.id}
                onClick={() => setSelectedTeam(team.name)}
                type="button"
              >
                <span>#{team.rank}</span>
                <strong>{team.name}</strong>
                <span>{team.score}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
