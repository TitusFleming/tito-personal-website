import { Suspense } from "react";
import Link from "next/link";
import ElectionsLookup from "./elections-lookup";

export const metadata = {
  title: "yourElections | Tito Fleming",
  description:
    "An interactive map of the 2026 primaries — click your state and district to see every race and candidate.",
};

export default function YourElectionsPage() {
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
          <p className="eyebrow">Civic tech</p>
          <h1>yourElections</h1>
          <p className="lede">
            Click your state on the map — or jump by zip code — to see your
            2026 primary ballot.
          </p>
        </section>

        <Suspense fallback={<div className="pulse-loading" />}>
          <ElectionsLookup />
        </Suspense>
      </div>
    </main>
  );
}
