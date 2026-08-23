import Link from "next/link";
import PhlemGame from "./game";

export const metadata = {
  title: 'Phlem.io | Richard "Tito" Fleming',
  description:
    "A single-player agar arena where every other blob is an AI named after an AREDL extreme demon. They hunt, flee, split, ragequit, and pretend to be people.",
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
