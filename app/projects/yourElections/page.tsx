import Link from "next/link";
import ElectionsLookup from "./elections-lookup";

export const metadata = {
  title: "yourElections | Tito Fleming",
  description: "Find your 2026 primary races and candidates by zip code.",
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
          <p className="lede">Type in your zip code, see your 2026 primary ballot.</p>
        </section>

        <ElectionsLookup />
      </div>
    </main>
  );
}
