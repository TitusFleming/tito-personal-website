import { NextResponse } from "next/server";

import { isWarm, voiceBaseUrl } from "../warm";

export const dynamic = "force-dynamic";

// Start the voice service waking, and return immediately.
//
// The wake itself takes ~30 seconds, far longer than this request should
// hold. So this fires the request that triggers the wake and hands back
// straight away; the browser then polls /api/voice/status until it flips.
// Keeping the waiting on the client side keeps us clear of serverless
// function duration limits entirely.
export async function POST() {
  const base = voiceBaseUrl();
  if (!base) {
    return NextResponse.json(
      { started: false, detail: "Voice agent is not configured." },
      { status: 500 },
    );
  }

  // isWarm's probe *is* the wake trigger on a sleeping instance. If it comes
  // back true the service was already up and there is nothing to wait for.
  const warm = await isWarm(base);
  return NextResponse.json({ started: true, warm });
}
