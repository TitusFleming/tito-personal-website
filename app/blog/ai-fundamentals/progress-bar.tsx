"use client";

import { useEffect, useState } from "react";

import s from "./post.module.css";

/** Reading-progress bar styled as the Geometry Dash percentage slider: gold
 *  outlined track, blue striped fill, gold ball riding the end of the fill. */
export default function ProgressBar() {
  const [p, setP] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className={s.gdBarWrap} aria-hidden="true">
      <div className={s.gdBarTrack}>
        <div className={s.gdBarFill} style={{ width: `calc(${p} * 100%)` }} />
      </div>
      <div className={s.gdBarKnob} style={{ left: `calc(${p} * (100% - 26px))` }} />
    </div>
  );
}
