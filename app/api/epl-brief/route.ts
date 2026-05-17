import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FplTeam = {
  id: number;
  name: string;
  short_name: string;
  strength: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
};

type FplFixture = {
  id: number;
  code: number;
  event: number | null;
  finished: boolean;
  kickoff_time: string | null;
  team_a: number;
  team_a_score: number | null;
  team_h: number;
  team_h_score: number | null;
};

type TeamMatch = {
  id: number;
  opponent: string;
  venue: "H" | "A";
  result: "W" | "D" | "L";
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  date: string | null;
};

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
  recentMatches: TeamMatch[];
};

const FPL_BOOTSTRAP = "https://fantasy.premierleague.com/api/bootstrap-static/";
const FPL_FIXTURES = "https://fantasy.premierleague.com/api/fixtures/";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getResult(goalsFor: number, goalsAgainst: number): "W" | "D" | "L" {
  if (goalsFor > goalsAgainst) return "W";
  if (goalsFor < goalsAgainst) return "L";
  return "D";
}

function getMood(score: number) {
  if (score >= 80) return "Flying";
  if (score >= 65) return "Trending up";
  if (score >= 45) return "Mixed";
  if (score >= 30) return "Slipping";
  return "Rough";
}

function buildVerdict(report: Omit<TeamReport, "rank" | "verdict">) {
  const { name, metrics, mood } = report;
  const bits = [];

  if (metrics.pointsPerMatch >= 2) bits.push("stacking points");
  else if (metrics.pointsPerMatch >= 1.2) bits.push("staying competitive");
  else bits.push("struggling to turn matches into points");

  if (metrics.goalDifference > 2) bits.push("with a positive goal trend");
  else if (metrics.goalDifference < -2) bits.push("but leaking more than they score");
  else bits.push("with tight margins");

  if (metrics.cleanSheets >= 2) bits.push("and defensive stability");

  return `${name} look ${mood.toLowerCase()}: ${bits.join(", ")}.`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "EPL Brief portfolio project",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function GET() {
  try {
    const [bootstrap, fixtures] = await Promise.all([
      getJson<{ teams: FplTeam[] }>(FPL_BOOTSTRAP),
      getJson<FplFixture[]>(FPL_FIXTURES),
    ]);

    const teamsById = new Map(bootstrap.teams.map((team) => [team.id, team]));
    const finishedFixtures = fixtures
      .filter(
        (fixture) =>
          fixture.finished &&
          fixture.team_h_score !== null &&
          fixture.team_a_score !== null,
      )
      .sort((a, b) => {
        const aTime = a.kickoff_time ? new Date(a.kickoff_time).getTime() : 0;
        const bTime = b.kickoff_time ? new Date(b.kickoff_time).getTime() : 0;
        return bTime - aTime;
      });

    const reportsWithoutRank = bootstrap.teams.map((team) => {
      const matches = finishedFixtures
        .filter((fixture) => fixture.team_h === team.id || fixture.team_a === team.id)
        .slice(0, 5)
        .map<TeamMatch>((fixture) => {
          const isHome = fixture.team_h === team.id;
          const opponentId = isHome ? fixture.team_a : fixture.team_h;
          const goalsFor = isHome ? fixture.team_h_score ?? 0 : fixture.team_a_score ?? 0;
          const goalsAgainst = isHome ? fixture.team_a_score ?? 0 : fixture.team_h_score ?? 0;
          const opponent = teamsById.get(opponentId);

          return {
            id: fixture.id,
            opponent: opponent?.short_name ?? "TBD",
            venue: isHome ? "H" : "A",
            result: getResult(goalsFor, goalsAgainst),
            goalsFor,
            goalsAgainst,
            goalDifference: goalsFor - goalsAgainst,
            date: fixture.kickoff_time,
          };
        });

      const recentPoints = matches.reduce((total, match) => {
        if (match.result === "W") return total + 3;
        if (match.result === "D") return total + 1;
        return total;
      }, 0);

      const goalsFor = matches.reduce((total, match) => total + match.goalsFor, 0);
      const goalsAgainst = matches.reduce((total, match) => total + match.goalsAgainst, 0);
      const cleanSheets = matches.filter((match) => match.goalsAgainst === 0).length;
      const goalDifference = goalsFor - goalsAgainst;
      const pointsPerMatch = matches.length ? recentPoints / matches.length : 0;
      const attackStrength = (team.strength_attack_home + team.strength_attack_away) / 2;
      const defenceStrength = (team.strength_defence_home + team.strength_defence_away) / 2;
      const opponentAdjustment = round((team.strength - 3) * 2, 1);

      const score = clamp(
        pointsPerMatch * 18 +
          goalDifference * 5 +
          goalsFor * 2.2 -
          goalsAgainst * 2.4 +
          cleanSheets * 4 +
          (attackStrength - 1000) / 35 +
          (defenceStrength - 1000) / 45 +
          opponentAdjustment +
          35,
      );

      const report = {
        id: team.id,
        name: team.name,
        shortName: team.short_name,
        score: Math.round(score),
        mood: getMood(score),
        metrics: {
          matchesPlayed: matches.length,
          recentPoints,
          pointsPerMatch: round(pointsPerMatch),
          goalsFor,
          goalsAgainst,
          goalDifference,
          cleanSheets,
          attackStrength: Math.round(attackStrength),
          defenceStrength: Math.round(defenceStrength),
          opponentAdjustment,
        },
        recentMatches: matches,
      };

      return {
        ...report,
        verdict: buildVerdict(report),
      };
    });

    const ranked = [...reportsWithoutRank].sort((a, b) => b.score - a.score);
    const rankById = new Map(ranked.map((report, index) => [report.id, index + 1]));
    const teams: TeamReport[] = reportsWithoutRank
      .map((report) => ({
        ...report,
        rank: rankById.get(report.id) ?? reportsWithoutRank.length,
      }))
      .sort((a, b) => a.rank - b.rank);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      source: "Fantasy Premier League public API",
      teams,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to build team reports",
      },
      { status: 502 },
    );
  }
}
