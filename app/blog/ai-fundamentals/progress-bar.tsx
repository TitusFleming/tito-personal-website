"use client";

import { useEffect, useState } from "react";

/** Thin gradient reading-progress bar pinned to the top of the viewport. */
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
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        zIndex: 50,
        transformOrigin: "0 50%",
        transform: `scaleX(${p})`,
        background: "linear-gradient(90deg, #22d3ee, #a78bfa)",
      }}
    />
  );
}
