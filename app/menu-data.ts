export type ProjectItem = {
  label: string;
  meta: string;
  blurb: string;
  tags: string[];
  href?: string;
};

export type ProjectGroup = {
  title: string;
  items: ProjectItem[];
};

/** Grouped by where the work happened, so the professional work reads as
 *  professional work rather than sitting in one undifferentiated pile. */
export const PROJECT_GROUPS: ProjectGroup[] = [
  {
    title: "Personal",
    items: [
      {
        label: "yourElections",
        meta: "Civic tech",
        blurb:
          "An interactive map of the 2026 primaries — click your state and district to see every race and candidate. There's a voice agent on the other end of the same data.",
        tags: ["Next.js", "FastAPI", "Postgres", "d3-geo"],
        href: "/projects/yourElections",
      },
      {
        label: "EPL Brief",
        meta: "Football data",
        blurb: "A Premier League team form tracker for fans who have not watched every match.",
        tags: ["Next.js", "Runtime API"],
        href: "/projects/epl-brief",
      },
      {
        label: "GDDL Higher or Lower",
        meta: "Browser game",
        blurb:
          "Pick a tier range and guess which Geometry Dash level ranks harder on the GDDL. Go until you get one wrong.",
        tags: ["Geometry Dash", "GDDL"],
        href: "/projects/gd-tier-game",
      },
    ],
  },
  {
    title: "Internships",
    items: [
      {
        label: "Cummins — Big Cam",
        meta: "Digital Tools Intern · Columbus, IN",
        blurb:
          "Built an LLM fault-code assistant into the Guidanz mobile app, so a technician can ask about an ECM code in plain language. Android Studio, Java and C++. The page is the other half: the NTC-400 from the lobby, rebuilt in code so you can pull it apart.",
        tags: ["Android", "Java", "C++", "Three.js"],
        href: "/projects/cummins",
      },
      {
        label: "Retirement Cohort Models",
        meta: "Fidelity Investments",
        blurb: "Snowflake models for analyzing retirement customer behavior.",
        tags: ["SQL", "Snowflake", "Analytics"],
      },
    ],
  },
  {
    title: "Research",
    items: [
      {
        label: "Battery Storage Analysis",
        meta: "Energy markets",
        blurb: "Feasibility and incentive research for a 400MWh battery energy storage project.",
        tags: ["Energy", "Markets", "Policy"],
      },
    ],
  },
];

export const RESUME = {
  education: [
    {
      place: "Brown University",
      detail: "Computer Science",
      when: "Providence, RI",
    },
  ],
  experience: [
    {
      place: "Cummins Inc.",
      detail:
        "Digital Tools Intern, Guidanz team — Fuel Systems facility. Built an LLM-backed diagnostic feature in the Guidanz mobile app for reading ECM fault codes, in Java and C++.",
      when: "Columbus, IN",
    },
    {
      place: "Fidelity Investments",
      detail: "Snowflake models analyzing retirement customer behaviour.",
      when: "Data systems",
    },
    {
      place: "Battery storage research",
      detail: "Feasibility and incentive research for a 400MWh energy storage project.",
      when: "Energy",
    },
  ],
  skills: [
    "TypeScript",
    "React / Next.js",
    "Python",
    "Java",
    "C++",
    "SQL / Snowflake",
    "Postgres",
    "FastAPI",
    "Three.js",
  ],
};
