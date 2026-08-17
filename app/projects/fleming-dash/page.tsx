import Link from "next/link";
import Game from "./game";

export const metadata = {
  title: "Fleming Dash | Tito Fleming",
  description:
    "A Geometry Dash-style platformer built from scratch: fixed-timestep physics, cube and ship modes, and Stereo Madness imported from the original level data.",
};

export default function FlemingDashPage() {
  return (
    <main className="min-h-screen text-[#181713]">
      <div className="fdash-page">
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

        <section className="project-hero fdash-hero">
          <p className="eyebrow">Browser game</p>
          <h1>Fleming Dash</h1>
          <p className="lede">
            One button, two gamemodes, and a level lifted straight out of the real game.
          </p>
        </section>

        <Game />
      </div>
    </main>
  );
}
