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
 *  professional work rather than sitting in one undifferentiated pile.
 *  Within a group, items run most impressive first — the top of the list is
 *  what a skimming reader takes away. */
export const PROJECT_GROUPS: ProjectGroup[] = [
  {
    title: "Personal",
    items: [
      {
        label: "Fleming Dash",
        meta: "Browser game",
        blurb:
          "A Geometry Dash-style platformer built from scratch: a deterministic fixed-timestep engine, physics sourced from the real game's decompilation, and Stereo Madness imported from the original level data. More levels in progress.",
        tags: ["Canvas", "Game engine", "TypeScript"],
        href: "/projects/fleming-dash",
      },
      {
        label: "yourElections",
        meta: "Civic tech",
        blurb:
          "An interactive map of the 2026 primaries. Click your state and district to see every race and candidate. There's a voice agent on the other end of the same data.",
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
        label: "Cummins: Big Cam",
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
  // Sourced from the 08.26 resume PDF. The home address and phone number on
  // that document are deliberately NOT carried over — the Contact section
  // already gives an email, and a street address on a public page is worth
  // nothing to a reader and plenty to a scraper.
  education: [
    {
      place: "Brown University",
      detail:
        "BS in Computer Science candidate, class of 2027. Coursework across AI, machine learning, deep learning, computer systems, data structures, algorithms, cybersecurity and linear algebra. 2023 HSF Scholar and MOSAIC+; SHPE and Alpha Delta Phi Society.",
      when: "Providence, RI",
    },
    {
      place: "Science Academy of South Texas",
      detail:
        "Summa cum laude, class of 2023. National Merit Scholarship Finalist, National Hispanic Scholar, National Rural & Small Town Scholar, AP Scholar with Distinction. President of the Computer Science Club.",
      when: "Mercedes, TX",
    },
  ],
  experience: [
    {
      place: "Cummins Inc.",
      detail:
        "Software engineering intern. Built an AI diagnostic feature in the Guidanz app letting service technicians query and interpret engine fault codes with LLMs — Android Studio in Java and C++, integrating OpenAI ChatKit. Shipped to production and live in diagnostic workflows at 13,000+ dealer and 640+ distributor locations.",
      when: "May – Aug 2026 · Columbus, IN",
    },
    {
      place: "Fidelity Investments",
      detail:
        "Data analytics & insights intern. Engineered SQL cohort models in Snowflake over 12.8M retirement customers and roughly $2T in transactions, and presented the findings to senior leadership.",
      when: "Jun – Aug 2025 · Boston, MA",
    },
    {
      place: "TocDoc",
      detail:
        "Built a HIPAA-compliant hospital discharge notification and transition-of-care portal for independent physician groups serving Medicare Advantage patients, raising transition-of-care compliance by 37%.",
      when: "May 2025 – present · Boston, MA",
    },
    {
      place: "El Centro Group Development",
      detail:
        "Analyst on a 400MWh battery energy storage project: feasibility and regulatory compliance, tax credit incentives and transferability under the 2022 IRA, DCF modelling, and land lease negotiation support.",
      when: "Jun – Aug 2024 · McAllen, TX",
    },
    {
      place: "MITES Semester, MIT",
      detail:
        "One of 270 students selected nationwide for a six-month academic and professional development programme. Now an alumni volunteer, mentoring through essay reviews and mock interviews.",
      when: "2022 · Cambridge, MA",
    },
  ],
  skills: [
    "Python",
    "C++",
    "Java",
    "TypeScript",
    "R",
    "React / Next.js",
    "Node.js",
    "SQL / Snowflake",
    "Postgres",
    "FastAPI",
    "Three.js",
    "TensorFlow",
    "Docker",
    "AWS / Google Cloud",
    "MongoDB",
    "Tableau",
    "Git",
    "Linux",
    "Spanish (ILR 3)",
  ],
};
