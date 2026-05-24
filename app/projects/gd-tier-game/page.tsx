import Link from "next/link";
import Game from "./game";

export const metadata = {
  title: "GDDL Higher or Lower | Tito Fleming",
  description:
    "Pick a tier range and guess which Geometry Dash level ranks harder on the GDDL. Go until you get one wrong.",
};

export default function GDDLPage() {
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
          <p className="eyebrow">Browser game</p>
          <h1>GDDL Higher or Lower</h1>
          <p className="lede">
            How much do you know about GD demons?
          </p>
        </section>

        <Game />
      </div>
    </main>
  );
}
