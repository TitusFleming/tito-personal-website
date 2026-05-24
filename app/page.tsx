const projects = [
  {
    title: "EPL Brief",
    type: "Football data",
    status: "Live project",
    description: "A Premier League team form tracker for fans who have not watched every match.",
    href: "/projects/epl-brief",
    tags: ["Next.js", "Runtime API", "Football"],
  },
  {
    title: "GDDL Higher or Lower",
    type: "Browser game",
    status: "Live project",
    description: "Pick a tier range and guess which GD level ranks harder on the GDDL. Go until you get one wrong.",
    href: "/projects/gd-tier-game",
    tags: ["Geometry Dash", "GDDL", "Browser Game"],
  },
  {
    title: "Retirement Cohort Models",
    type: "Data systems",
    status: "Internship",
    description: "Snowflake models for analyzing retirement customer behavior at Fidelity Investments.",
    href: "",
    tags: ["SQL", "Snowflake", "Analytics"],
  },
  {
    title: "Battery Storage Analysis",
    type: "Energy",
    status: "Research",
    description: "Feasibility and incentive research for a 400MWh battery energy storage project.",
    href: "",
    tags: ["Energy", "Markets", "Policy"],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen text-[#181713]">
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="site-header">
          <a className="site-mark" href="#top" aria-label="Richard Tito Fleming home">
            RTF
          </a>
          <nav aria-label="Primary navigation">
            <a href="#portfolio">Portfolio</a>
            <a href="#about">About</a>
            <a href="mailto:richard_fleming@brown.edu">Contact</a>
          </nav>
        </header>

        <section id="top" className="hero">
          <div className="portrait-frame" aria-label="Richard Tito Fleming portrait" />
          <div className="hero-copy">
            <p className="eyebrow">Richard &quot;Tito&quot; Fleming</p>
            <h1>Tito Fleming</h1>
            <p className="lede">
              Brown CS student making software, data projects, and technical experiments.
            </p>
            <div className="hero-links">
              <a href="#portfolio">Projects</a>
              <a href="mailto:richard_fleming@brown.edu">Email</a>
            </div>
          </div>
        </section>

        <section id="portfolio" className="section-block" aria-labelledby="portfolio-title">
          <div className="section-heading">
            <p className="eyebrow">Work</p>
            <h2 id="portfolio-title">Projects</h2>
          </div>

          <div className="project-grid">
            {projects.map((project) => {
              const content = (
                <>
                  <div className="project-topline">
                    <span>{project.type}</span>
                    <span>{project.status}</span>
                  </div>
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                  <div className="tag-row">
                    {project.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  {project.href ? <span className="project-link-cue">Open project</span> : null}
                </>
              );

              return project.href ? (
                <a className="project-card project-card-linked" href={project.href} key={project.title}>
                  {content}
                </a>
              ) : (
                <article className="project-card" key={project.title}>
                  {content}
                </article>
              );
            })}
          </div>
        </section>

        <section className="details-grid single-detail" id="about">
          <section className="mini-section" aria-labelledby="about-title">
            <p className="eyebrow">About</p>
            <h2 id="about-title">I like projects with a little bit of data and a little bit of personality.</h2>
            <p>
              Currently at Brown. Reach me at{" "}
              <a href="mailto:richard_fleming@brown.edu">richard_fleming@brown.edu</a>.
            </p>
          </section>
        </section>

        <footer>
          <a href="mailto:richard_fleming@brown.edu">richard_fleming@brown.edu</a>
          <a href="https://titofleming.com">titofleming.com</a>
          <a href="https://www.linkedin.com/in/tito-fleming/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </footer>
      </div>
    </main>
  );
}
