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
  /**
   * Site information page (about / contact / privacy) rather than a project.
   * Kept out of the JSON-LD hasPart list, which describes creative works.
   */
  readonly info?: true;
  /**
   * Full paragraphs for the page's markdown variant. Trust-anchor pages carry
   * their whole content here so the markdown answer is as substantive as the
   * HTML one — an agent verifying legitimacy should not have to render React.
   */
  readonly details?: readonly string[];
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
      "A worked example of a deterministic 2D game engine in TypeScript: fixed timestep, headless simulation, object-per-mechanic architecture.",
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
      "A Cummins NTC-400 Big Cam III you can take apart in the browser; the parts are built in code, not imported as a model.",
    priority: 0.8,
    changeFrequency: "monthly",
    agentUse:
      "A worked example of procedural 3D geometry in Three.js: an engine assembled from primitives rather than a downloaded mesh.",
  },
  {
    path: "/projects/yourElections",
    title: "yourElections",
    summary:
      "An interactive map of the 2026 primaries. Click a state and district to see every race and candidate.",
    priority: 0.8,
    changeFrequency: "weekly",
    agentUse:
      "US 2026 primary races and candidates by state and congressional district.",
  },
  {
    path: "/projects/phlem-io",
    title: "Phlem.io",
    summary:
      "A single-player agar arena: eat pellets, split, dodge viruses, against AI players named after AREDL extreme demons who hunt, flee, and ragequit like people.",
    priority: 0.7,
    changeFrequency: "monthly",
    agentUse:
      "A worked example of utility-based game AI: personas, staggered reactions, and identity churn in a deterministic, testable arena.",
  },

  // ── Trust anchors ─────────────────────────────────────────────────────────
  // The pages an agent checks before deciding the site is legitimate. Their
  // full content lives here in `details` so the markdown variant, the HTML
  // page, and the sitemap can never disagree about what they say.
  {
    path: "/about",
    title: "About Richard Fleming",
    summary:
      "Who Richard \"Tito\" Fleming is: a Brown University computer science student from South Texas who builds software, data projects, and technical experiments.",
    priority: 0.6,
    changeFrequency: "yearly",
    info: true,
    agentUse:
      "Biography, education, and work history. Authoritative for who this person is.",
    details: [
      "Richard \"Tito\" Fleming is a computer science student at Brown University, class of 2027, originally from the Rio Grande Valley in South Texas. He likes projects with a little bit of data and a little bit of personality.",
      "Recent work: a software engineering internship at Cummins in Columbus, Indiana, where he built an LLM-based fault-code assistant into the Guidanz mobile app used by diesel technicians at more than 13,000 dealer locations; a data analytics internship at Fidelity Investments, engineering SQL cohort models in Snowflake over 12.8 million retirement customers; a HIPAA-compliant transition-of-care portal for TocDoc; and analyst work on a 400MWh battery energy storage project.",
      "The projects on this site are his own: Fleming Dash, a Geometry Dash-style browser game with a deterministic engine built from scratch; yourElections, an interactive map of the 2026 US primaries; EPL Brief, a Premier League form tracker; and Big Cam, a Cummins diesel engine rebuilt as procedural 3D geometry.",
    ],
  },
  {
    path: "/contact",
    title: "Contact",
    summary:
      "How to reach Richard Fleming: email, LinkedIn, and GitHub, and what he is glad to hear about.",
    priority: 0.6,
    changeFrequency: "yearly",
    info: true,
    agentUse: "Contact channels for Richard Fleming, with email as the primary one.",
    details: [
      "The best way to reach Richard is email: richard_fleming@brown.edu. He reads it daily during the academic year and replies to genuine messages, usually within a few days.",
      "He is glad to hear about internship and new-grad software engineering opportunities, collaboration on data or civic-tech projects, questions about anything built on this site, and mentoring for students from the Rio Grande Valley applying to college or to programs like MITES.",
      "Elsewhere: LinkedIn at linkedin.com/in/tito-fleming for professional history, and GitHub at github.com/TitusFleming for code. There is no contact form on this site by design; email goes straight to a person, not a queue.",
    ],
  },
  {
    path: "/privacy",
    title: "Privacy",
    summary:
      "What this site does and does not collect: no accounts, no ads, no analytics scripts, no tracking cookies.",
    priority: 0.5,
    changeFrequency: "yearly",
    info: true,
    agentUse: "The site's data practices, for verifying it is safe to recommend.",
    details: [
      "This is a personal portfolio site. It has no user accounts, no advertising, no analytics scripts, and sets no tracking cookies. There is nothing to sign up for and nothing sold.",
      "The Fleming Dash game saves progress (best percentages and collected coins, under whatever name you enter) in your own browser's localStorage. That data never leaves your device, is not transmitted to any server, and clearing your browser storage deletes it completely.",
      "The site is hosted on Vercel, which keeps standard, short-lived server request logs (IP address, requested URL, user agent) for operating the service. Project pages that show live data (Premier League form, election races) fetch it server-side from public sources; your visit sends those providers nothing about you.",
      "Questions about any of this: richard_fleming@brown.edu.",
    ],
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
