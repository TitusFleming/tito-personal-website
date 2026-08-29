import Link from "next/link";
import PhlemGame from "./game";

export const metadata = {
  title: 'Phlem.io | Richard "Tito" Fleming',
  description:
    "A single-player agar.io inspired arena where every other blob is an AI named after an extreme demon from Geometry Dash. They hunt, flee, split on you, and ragequit if they get eaten too much.",
};

export default function PhlemIoPage() {
  return (
    <main className="fdash-main">
      <div className="fdash-page">
        <header className="site-header fdash-header">
          <Link className="site-mark" href="/" aria-label="Back to Richard Fleming home">
            RTF
          </Link>
          <nav aria-label="Project navigation">
            <Link href="/">Home</Link>
            <Link href="/#portfolio">Portfolio</Link>
          </nav>
        </header>

        <PhlemGame />
      </div>
    </main>
  );
}
