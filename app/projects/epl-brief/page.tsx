import Link from "next/link";
import TeamPulse from "./team-pulse";

export const metadata = {
  title: "EPL Brief | Tito Fleming",
  description: "A runtime Premier League form tracker for fans catching up on their club.",
};

export default function HowIsMyTeamDoingPage() {
  return (
    <main className="min-h-screen text-[#181713]">
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="site-header">
          <Link className="site-mark" href="/" aria-label="Back to Tito Fleming home">
            RTF
          </Link>
          <nav aria-label="Project navigation">
            <Link href="/">Home</Link>
            <Link href="/#portfolio">Portfolio</Link>
            <a href="mailto:richard_fleming@brown.edu">Contact</a>
          </nav>
        </header>

        <section className="project-hero">
          <p className="eyebrow">Live football data project</p>
          <h1>EPL Brief</h1>
          <p className="lede">
            Pick a team, see how they&apos;re doing.
          </p>
        </section>

        <TeamPulse />
      </div>
    </main>
  );
}
