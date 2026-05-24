import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type GDDLRawLevel = {
  ID: number;
  Rating: number;
  Showcase: string;
  Meta: {
    Name: string;
    Publisher: { name: string } | null;
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawMin = Number(searchParams.get("minTier"));
  const rawMax = Number(searchParams.get("maxTier"));
  const minTier = isNaN(rawMin) || rawMin < 1 ? 1 : Math.min(rawMin, 38);
  const maxTier = isNaN(rawMax) || rawMax <= minTier ? minTier + 1 : Math.min(rawMax, 39);

  const headers = {
    "Accept": "application/json",
    "User-Agent": "GDDL Higher or Lower - portfolio project by Tito Fleming",
    "Referer": "https://gdladder.com/",
  };

  function gddlUrl(page: number) {
    return `https://gdladder.com/api/level/search?query=&minRating=${minTier}&maxRating=${maxTier}&limit=25&page=${page}`;
  }

  try {
    const [res0, res1] = await Promise.all([
      fetch(gddlUrl(0), { headers }),
      fetch(gddlUrl(1), { headers }),
    ]);

    if (!res0.ok) {
      const body = await res0.text().catch(() => "");
      return NextResponse.json(
        { error: `GDDL returned ${res0.status}`, detail: body },
        { status: 502 },
      );
    }

    const data0 = await res0.json();
    const data1 = res1.ok ? await res1.json() : { levels: [] };

    const raw = [...(data0.levels ?? []), ...(data1.levels ?? [])] as GDDLRawLevel[];
    const levels = raw
      .filter((l) => l.Showcase && l.Rating != null && isFinite(l.Rating))
      .map((l) => ({
        id: l.ID,
        name: l.Meta.Name,
        creator: l.Meta.Publisher?.name ?? "Unknown",
        tierScore: l.Rating,
        showcase: l.Showcase,
      }));

    return NextResponse.json({ levels });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch GDDL data" },
      { status: 502 },
    );
  }
}
