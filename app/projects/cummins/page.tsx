import Link from "next/link";
import EngineExplorer from "./engine-explorer";

export const metadata = {
  title: "Big Cam | Tito Fleming",
  description:
    "A Cummins NTC-400 Big Cam III you can take apart in the browser — thirteen parts, built in code.",
};

export default function CumminsPage() {
  return (
    <main className="min-h-screen">
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

        <section className="project-hero engine-hero">
          <p className="eyebrow">Cummins NTC-400 Big Cam III</p>
          <h1>Big Cam</h1>
        </section>

        <EngineExplorer />
      </div>
    </main>
  );
}
