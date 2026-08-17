import Link from "next/link";
import EngineExplorer from "./engine-explorer";

export const metadata = {
  title: "Big Cam | Tito Fleming",
  description:
    "A Cummins NTC-400 Big Cam III you can take apart in the browser, and the summer I spent building a fault-code assistant for the technicians who work on its descendants.",
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
            <Link href="/">Home</Link>
            <Link href="/#portfolio">Portfolio</Link>
            <a href="mailto:richard_fleming@brown.edu">Contact</a>
          </nav>
        </header>

        <section className="project-hero">
          <p className="eyebrow">Digital tools · Cummins</p>
          <h1>Big Cam</h1>
          <p className="lede">
            Ten weeks in Columbus, Indiana, building a fault-code assistant for
            diesel technicians. There is a 14-litre engine hanging in pieces in
            the lobby. This page has both.
          </p>
        </section>

        <section className="section-block engine-prose" aria-labelledby="work-title">
          <div className="section-heading">
            <p className="eyebrow">The work</p>
            <h2 id="work-title">Asking an engine what&apos;s wrong with it</h2>
          </div>
          <p>
            I spent the summer as a Digital Tools Intern on the Guidanz team at
            Cummins&apos; Fuel Systems facility in Columbus, Indiana.
          </p>
          <p>
            Guidanz is the app technicians use to read fault codes off an
            engine&apos;s ECM. Over ten weeks I built an AI diagnostic feature for
            the mobile app, so a technician can ask about a fault code in plain
            language instead of working from raw diagnostic output alone. I wrote
            it in Android Studio in Java and C++, integrating OpenAI ChatKit into
            the existing Guidanz workflow.
          </p>
          <p>
            Guidanz reaches technicians at more than 13,000 certified dealer
            locations and 640 distributors. As an introduction to writing
            software that people actually use at work, it was hard to beat.
          </p>
        </section>

        <section className="section-block engine-prose" aria-labelledby="sculpture-title">
          <div className="section-heading">
            <p className="eyebrow">The sculpture</p>
            <h2 id="sculpture-title">There is an engine hanging in the lobby</h2>
          </div>
          <p>
            <em>Exploded Engine</em> is a Cummins NTC-400 Big Cam III pulled apart
            into more than 500 real production parts and suspended in midair.
            Rudolph de Harak designed it in 1984; Cummins employees assembled it,
            with nearly 30 engineers contributing. De Harak was a graphic designer
            rather than a sculptor, and it shows — the piece is a technical drawing
            that someone went and built.
          </p>
          <p>
            Below is my own version of the same idea, in a browser. Every part is
            drawn in code rather than modelled, which is its own kind of homage:
            de Harak&apos;s engine is made of the real thing, and mine is made of
            arithmetic.
          </p>
        </section>

        <EngineExplorer />

        <section className="section-block engine-prose" aria-labelledby="gap-title">
          <div className="section-heading">
            <p className="eyebrow">The gap</p>
            <h2 id="gap-title">This engine has no computer in it</h2>
          </div>
          <p>
            One thing about the engine in the lobby: the feature I built could
            never have diagnosed it.
          </p>
          <p>
            The NTC-400 has no ECM. No sensors, no control unit, nothing to plug
            into. Fuel delivery is settled by a gear pump, a metering valve, a
            spring inside each injector, and a set of flyweights spinning on a
            governor shaft. Timing comes off the camshaft. When something goes
            wrong it does not log a fault code — it just runs badly, and someone
            who knows the engine works out why.
          </p>
          <p>
            Guidanz exists because that stopped being true. Somewhere between 1985
            and now, diagnosis moved out of the mechanic&apos;s ear and into the
            ECM, and the job became reading what the engine already knows about
            itself. I spent the summer making that easier to ask questions of, in
            a building with a 14-litre argument for the old way hanging in the
            lobby.
          </p>
        </section>
      </div>
    </main>
  );
}
