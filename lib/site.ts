// One description of the site, shared by every machine-readable surface.
//
// The sitemap, llms.txt, the JSON-LD identity block and the markdown variants
// all derive from this. Keeping them on one source is what stops them drifting
// apart — a project added to the homepage but missing from the sitemap is the
// usual way these files go stale.

export const SITE_URL = "https://www.richard-fleming.com";

export const PERSON = {
  name: 'Richard "Tito" Fleming',
  shortName: "Tito Fleming",
  email: "richard_fleming@brown.edu",
  summary: "Brown CS student making software, data projects, and technical experiments.",
  affiliation: "Brown University",
  sameAs: ["https://www.linkedin.com/in/tito-fleming/"],
} as const;

export type SiteRoute = {
  /** Path, root-relative, no trailing slash except "/". */
  readonly path: string;
  readonly title: string;
  readonly summary: string;
  /** Sitemap priority, 0-1. */
  readonly priority: number;
  readonly changeFrequency: "yearly" | "monthly" | "weekly";
  /** What an agent can actually do here. Feeds llms.txt "when to use". */
  readonly agentUse?: string;
};

export const ROUTES: readonly SiteRoute[] = [
  {
    path: "/",
    title: 'Richard "Tito" Fleming',
    summary: PERSON.summary,
    priority: 1,
    changeFrequency: "monthly",
    agentUse:
      "Identity, contact details, and the full project index. Start here to establish who this person is.",
  },
  {
    path: "/projects/epl-brief",
    title: "EPL Brief",
    summary:
      "A Premier League team form tracker for fans who have not watched every match. Reads the public Fantasy Premier League API at request time.",
    priority: 0.8,
    changeFrequency: "weekly",
    agentUse: "Current Premier League team form, pulled live rather than cached.",
  },
  {
    path: "/projects/fleming-dash",
    title: "Fleming Dash",
    summary:
      "A Geometry Dash-style platformer built from scratch: fixed-timestep physics, cube and ship modes, practice checkpoints, and levels imported from the original game data.",
    priority: 0.8,
    changeFrequency: "monthly",
    agentUse:
      "A worked example of a deterministic 2D game engine in TypeScript — fixed timestep, headless simulation, object-per-mechanic architecture.",
  },
  {
    path: "/projects/gd-tier-game",
    title: "GDDL Higher or Lower",
    summary:
      "Pick a tier range and guess which Geometry Dash level ranks harder on the GDDL. Go until you get one wrong.",
    priority: 0.7,
    changeFrequency: "monthly",
    agentUse: "Geometry Dash Demon List difficulty ratings, presented as a guessing game.",
  },
  {
    path: "/projects/cummins",
    title: "Big Cam",
    summary:
      "A Cummins NTC-400 Big Cam III you can take apart in the browser — the parts are built in code, not imported as a model.",
    priority: 0.8,
    changeFrequency: "monthly",
    agentUse:
      "A worked example of procedural 3D geometry in Three.js: an engine assembled from primitives rather than a downloaded mesh.",
  },
  {
    path: "/projects/yourElections",
    title: "yourElections",
    summary:
      "An interactive map of the 2026 primaries — click a state and district to see every race and candidate.",
    priority: 0.8,
    changeFrequency: "weekly",
    agentUse:
      "US 2026 primary races and candidates by state and congressional district.",
  },
] as const;

/** Projects listed on the homepage that have no page of their own. */
export const OFFLINE_PROJECTS = [
  {
    title: "Retirement Cohort Models",
    summary:
      "Snowflake models for analyzing retirement customer behavior at Fidelity Investments.",
  },
  {
    title: "Battery Storage Analysis",
    summary:
      "Feasibility and incentive research for a 400MWh battery energy storage project.",
  },
] as const;

export function routeFor(path: string): SiteRoute | undefined {
  const clean = path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
  return ROUTES.find((r) => r.path === clean);
}
