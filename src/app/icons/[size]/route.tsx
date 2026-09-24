import { ImageResponse } from "next/og";

// PWA / home-screen icons: the orange SKJÓL tile. `512m` is the maskable variant
// (extra padding so Android's circle crop keeps the mark intact).
const SIZES: Record<string, { px: number; pad: number }> = {
  "180": { px: 180, pad: 0 },
  "192": { px: 192, pad: 0 },
  "512": { px: 512, pad: 0 },
  "512m": { px: 512, pad: 0.12 },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size } = await ctx.params;
  const s = SIZES[size] || SIZES["192"];
  const inner = s.px * (1 - s.pad * 2);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F2622A" }}>
        <svg width={inner * 0.62} height={inner * 0.62} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11h18" />
          <path d="M5 11v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
          <path d="M1.5 11h2M20.5 11h2" />
          <path d="M9 7.5c0-1.2.8-1.5.8-2.7M12 7.5c0-1.2.8-1.5.8-2.7M15 7.5c0-1.2.8-1.5.8-2.7" />
        </svg>
      </div>
    ),
    { width: s.px, height: s.px },
  );
}
