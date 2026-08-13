import { NextResponse } from "next/server";

import { isWarm, voiceBaseUrl } from "../warm";

export const dynamic = "force-dynamic";

// Is the agent awake? Used by the card on the yourElections page to poll
// after someone presses Wake.
//
// Note this is not a free read: probing a sleeping Render instance wakes it.
// That is fine while the user is deliberately waiting for a wake, and is why
// the card must never poll this on page load — see the comment in warm.ts.
export async function GET() {
  const base = voiceBaseUrl();
  if (!base) {
    return NextResponse.json(
      { warm: false, detail: "Voice agent is not configured." },
      { status: 500 },
    );
  }
  return NextResponse.json({ warm: await isWarm(base) });
}
