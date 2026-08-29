"use client";

import { useEffect, useRef, useState } from "react";

// The phone agent, surfaced next to the map it mirrors.
//
// Deliberately does NOT check whether the agent is awake on mount. The agent
// runs on a free Render instance that sleeps, and *any* request wakes it, 
// including a status check. Those instance-hours are pooled across the whole
// Render account, so a probe on every page view would quietly spend the
// budget that keeps the elections backend running. Nothing is checked until
// someone actually presses the button.

const POLL_MS = 3000;
const GIVE_UP_MS = 75000;

type Status = "unknown" | "waking" | "ready" | "slow";

export default function VoiceCard() {
  const [status, setStatus] = useState<Status>("unknown");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  async function wake() {
    if (status === "waking" || status === "ready") return;
    setStatus("waking");

    try {
      const res = await fetch("/api/voice/wake", { method: "POST" });
      const data = await res.json();
      if (data.warm) {
        setStatus("ready");
        return;
      }
    } catch {
      // Fall through to polling, the wake request may well have landed
      // even if reading the response didn't.
    }

    const startedAt = Date.now();
    const poll = async () => {
      try {
        const res = await fetch("/api/voice/status", { cache: "no-store" });
        const data = await res.json();
        if (data.warm) {
          setStatus("ready");
          return;
        }
      } catch {
        // Keep polling; a cold instance refuses connections while it boots.
      }
      if (Date.now() - startedAt > GIVE_UP_MS) {
        setStatus("slow");
        return;
      }
      timers.current.push(setTimeout(poll, POLL_MS));
    };
    timers.current.push(setTimeout(poll, POLL_MS));
  }

  const number = process.env.NEXT_PUBLIC_VOICE_NUMBER;

  return (
    <section className="voice-card" aria-labelledby="voice-card-heading">
      <p className="eyebrow">Also available by phone</p>
      <h3 id="voice-card-heading">Talk to it instead</h3>
      <p className="voice-card-note">
        There&rsquo;s a voice agent on the other end of this data. Call it and ask
        what&rsquo;s in the database, or what&rsquo;s on your ballot.
      </p>

      {number ? (
        <a className="voice-number" href={`tel:${number.replace(/[^\d+]/g, "")}`}>
          {number}
        </a>
      ) : (
        <p className="voice-card-note">The number isn&rsquo;t configured yet.</p>
      )}

      {status === "ready" ? (
        <p className="voice-status voice-status-ready">
          The agent is awake and will pick up right away.
        </p>
      ) : status === "waking" ? (
        <>
          <p className="voice-status">
            Waking the agent up (it spins down when idle), this takes about
            thirty seconds.
          </p>
          <div className="pulse-loading" />
        </>
      ) : status === "slow" ? (
        <p className="voice-status">
          Still not up. You can call anyway, it&rsquo;ll greet you and ask you
          to hold while it starts.
        </p>
      ) : (
        <>
          <button className="voice-wake-btn" onClick={wake} type="button">
            Wake the agent
          </button>
          <p className="voice-card-note">
            Optional. Calling cold works too, you&rsquo;ll just be asked to
            hold for the first half-minute while it boots.
          </p>
        </>
      )}
    </section>
  );
}
