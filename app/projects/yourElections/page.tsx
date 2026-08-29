import { Suspense } from "react";
import Link from "next/link";
import ElectionsLookup from "./elections-lookup";
import VoiceCard from "./voice-card";

export const metadata = {
  title: "yourElections | Tito Fleming",
  description:
    "An interactive map of the 2026 primaries. Click your state and district to see every race and candidate. Next.js, FastAPI, Postgres and d3-geo, with a voice agent on the same data.",
  openGraph: {
    title: "yourElections | Tito Fleming",
    description:
      "An interactive map of the 2026 primaries. Click your state and district to see every race and candidate. Next.js, FastAPI, Postgres and d3-geo, with a voice agent on the same data.",
    url: "https://www.richard-fleming.com/projects/yourElections",
    siteName: 'Richard "Tito" Fleming',
    type: "article",
  },
};

export default function YourElectionsPage() {
  return (
    <main className="min-h-screen text-[#181713]">
      <div className="elections-page">
        <header className="site-header">
          <Link className="site-mark" href="/" aria-label="Back to Tito Fleming home">
            RTF
          </Link>
          <nav aria-label="Project navigation">
            <Link href="/">Menu</Link>
            <a href="mailto:richard_fleming@brown.edu">Contact</a>
          </nav>
        </header>

        <section className="project-hero elections-hero">
          <p className="eyebrow">Civic tech</p>
          <h1>yourElections</h1>
          <p className="lede">
            Click your state, or jump by zip, to see your 2026 primary ballot.
          </p>
        </section>

        <Suspense fallback={<div className="pulse-loading" />}>
          <ElectionsLookup />
        </Suspense>

        <VoiceCard />
      </div>
    </main>
  );
}
