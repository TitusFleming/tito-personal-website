import Link from "next/link";
import EngineExplorer from "./engine-explorer";

export const metadata = {
  title: "Big Cam | Tito Fleming",
  description:
    "Built as a Digital Tools Intern at Cummins in Columbus, Indiana, on the Guidanz team: an LLM fault-code assistant for diesel technicians. The page itself is the NTC-400 Big Cam III from the headquarters lobby, rebuilt from scratch in code so you can pull it apart.",
  openGraph: {
    title: "Big Cam | Tito Fleming",
    description:
      "Built as a Digital Tools Intern at Cummins in Columbus, Indiana, on the Guidanz team: an LLM fault-code assistant for diesel technicians. The page itself is the NTC-400 Big Cam III from the headquarters lobby, rebuilt from scratch in code so you can pull it apart.",
    url: "https://www.richard-fleming.com/projects/cummins",
    siteName: 'Richard "Tito" Fleming',
    type: "article",
  },
};

export default function CumminsPage() {
  return (
    <main className="min-h-screen text-[#181713]">
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="site-header">
          <Link className="site-mark" href="/" aria-label="Back to Tito Fleming home">
            RTF
          </Link>
          <nav aria-label="Project navigation">
            <Link href="/">Menu</Link>
            <a href="mailto:richard_fleming@brown.edu">Contact</a>
          </nav>
        </header>

        <section className="project-hero engine-hero">
          <p className="eyebrow">Cummins NTC-400 Big Cam III</p>
          <h1>Big Cam</h1>
        </section>

        <EngineExplorer />
      </div>
    </main>
  );
}
