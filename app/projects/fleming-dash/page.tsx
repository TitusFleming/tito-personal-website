import Link from "next/link";
import Game from "./game";

export const metadata = {
  title: "Fleming Dash | Tito Fleming",
  description:
    "A Geometry Dash-style platformer built from scratch: fixed-timestep physics, cube and ship modes, practice checkpoints, and Stereo Madness imported from the original level data.",
};

export default function FlemingDashPage() {
  return (
    <main className="fdash-main">
      <div className="fdash-page">
        <header className="site-header fdash-header">
          <Link className="site-mark" href="/" aria-label="Back to Tito Fleming home">
            RTF
          </Link>
          <nav aria-label="Project navigation">
            <Link href="/">Home</Link>
            <Link href="/#portfolio">Portfolio</Link>
          </nav>
        </header>

        <Game />
      </div>
    </main>
  );
}
