import { NextResponse } from "next/server";

import { isWarm, voiceBaseUrl, voiceSocketUrl, wakeBackend } from "../warm";

export const dynamic = "force-dynamic";

// This is the Twilio "A call comes in" webhook, and it lives on Vercel rather
// than on the voice service for one reason: Twilio gives a webhook about 15
// seconds to answer, and the voice service is a free Render instance that
// sleeps after 15 idle minutes and takes ~30 seconds to come back. A webhook
// pointed straight at it would not be slow, it would fail the call outright.
//
// Vercel answers instantly whether or not the voice service is awake, so the
// wake happens where the caller can be told about it instead of listening to
// silence: greet, pause, redirect back here, and connect once it's up.

const MAX_ATTEMPTS = 4; // ~40s of bridging, comfortably past a ~30s cold start
const PAUSE_SECONDS = 10;

function twiml(body: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,
    { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } },
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function handle(request: Request) {
  const attempt = Number(new URL(request.url).searchParams.get("n")) || 0;

  const base = voiceBaseUrl();
  if (!base) {
    return twiml(
      "<Say>Sorry, the voice agent is not configured right now.</Say><Hangup/>",
    );
  }

  // Wake the elections backend on every pass, warm or cold. It sleeps on its
  // own 15-minute timer, so the voice service being up says nothing about
  // whether the data behind it is — and an agent that connects and then can't
  // reach the data is a worse call than one that asks you to hold.
  wakeBackend();

  // This probe doubles as the wake-up call: on Render, any request to a
  // sleeping instance starts it. So the failure path below has already set
  // the recovery in motion by the time we return.
  if (await isWarm(base)) {
    return twiml(
      `<Connect><Stream url="${escapeXml(voiceSocketUrl(base))}"/></Connect>`,
    );
  }

  if (attempt >= MAX_ATTEMPTS) {
    return twiml(
      "<Say>Sorry, the agent is taking too long to wake up. " +
        "Please try calling again in a minute.</Say><Hangup/>",
    );
  }

  // Say it once, on the first pass. Repeating the explanation every ten
  // seconds is worse than a bit of hold silence.
  const greeting =
    attempt === 0
      ? "<Say>Hi! Give me about thirty seconds to wake up — " +
        "this runs on a free server that goes to sleep.</Say>"
      : "";

  return twiml(
    `${greeting}<Pause length="${PAUSE_SECONDS}"/>` +
      `<Redirect method="POST">/api/voice/twiml?n=${attempt + 1}</Redirect>`,
  );
}

// Twilio posts by default, but a webhook configured as GET is a classic
// first-call failure that looks like a broken agent. Accept both.
export const POST = handle;
export const GET = handle;
