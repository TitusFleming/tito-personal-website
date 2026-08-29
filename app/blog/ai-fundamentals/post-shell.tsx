import Link from "next/link";
import type { ReactNode } from "react";

import { BLOG_SERIES } from "../../blog-data";
import GdBackground from "../../gd-background";
import ProgressBar from "./progress-bar";
import s from "./post.module.css";

/** Static demo bundles live in public/demos/. Rebuild and refresh them with
 *  ~/Desktop/code/hiloop/sync-demos.sh after editing a demo. */
const DEMOS: Record<number, { src: string; title: string; height: number; label: string }> = {
  1: {
    src: "/demos/mnist-decomposer/index.html",
    title: "MNIST decomposer",
    height: 940,
    label: "mnist-decomposer",
  },
  2: {
    src: "/demos/loss-landscape/index.html",
    title: "Loss landscape playground",
    height: 640,
    label: "loss-landscape",
  },
  3: {
    src: "/demos/word-predictor/index.html",
    title: "Next-word predictor",
    height: 1360,
    label: "word-predictor",
  },
};

export function DemoFrame({ part }: { part: number }) {
  const d = DEMOS[part];
  return (
    <div className={`${s.demoShell} ${s.reveal}`}>
      <div className={s.demoChrome}>
        <span className={s.dotR} />
        <span className={s.dotY} />
        <span className={s.dotG} />
        <span className={s.demoLabel}>{d.label} · live</span>
        <a className={s.demoOpen} href={d.src} target="_blank" rel="noopener noreferrer">
          open ↗
        </a>
      </div>
      <iframe src={d.src} title={d.title} height={d.height} className={s.demoFrame} loading="lazy" />
    </div>
  );
}

export function Bubble({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className={`${s.card} ${s.reveal}`}>
      <p className={s.cardKicker}>{kicker}</p>
      <div className={s.body}>{children}</div>
    </div>
  );
}

export default function PostShell({ part, children }: { part: number; children: ReactNode }) {
  const post = BLOG_SERIES.posts.find((p) => p.part === part)!;
  const prev = BLOG_SERIES.posts.find((p) => p.part === part - 1);
  const next = BLOG_SERIES.posts.find((p) => p.part === part + 1);

  return (
    <main className={s.page}>
      <ProgressBar />
      <GdBackground />
      <div className={s.scrim} aria-hidden="true" />

      <div className={`${s.content} mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:px-10`}>
        <header className="site-header">
          <Link className="site-mark" href="/" aria-label="Back to Tito Fleming home">
            RTF
          </Link>
          <nav aria-label="Blog navigation">
            <Link href="/">Menu</Link>
          </nav>
        </header>

        <section className="mt-14">
          <div className={s.heroTop}>
            <span className={s.kicker}>{post.meta}</span>
            <span className={s.stepper}>
              {BLOG_SERIES.posts.map((p) =>
                p.part === part ? (
                  <span key={p.part} className={s.stepOn}>
                    0{p.part}
                  </span>
                ) : (
                  <Link
                    key={p.part}
                    className={s.step}
                    href={`/blog/ai-fundamentals/${p.slug}`}
                    title={p.title}
                  >
                    0{p.part}
                  </Link>
                )
              )}
            </span>
          </div>
          <h1 className={s.title}>{post.title}</h1>
          <div className={s.heroRule} />
        </section>

        <article className="space-y-6">{children}</article>

        <nav className="mt-12 grid gap-4 sm:grid-cols-2">
          {prev ? (
            <Link className={s.navCard} href={`/blog/ai-fundamentals/${prev.slug}`}>
              <span className={s.navLabel}>← Part {prev.part}</span>
              <span className={s.navTitle}>{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              className={`${s.navCard} ${s.navRight}`}
              href={`/blog/ai-fundamentals/${next.slug}`}
            >
              <span className={s.navLabel}>Part {next.part} →</span>
              <span className={s.navTitle}>{next.title}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </main>
  );
}
