// Launch screen: orange tile, the kitchen pot with rising steam, SKJÓL wordmark
// and an indeterminate progress bar. Server-rendered as the loading state, then
// kept up by App until the shared data has arrived.
export default function Splash({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      aria-busy={!leaving}
      aria-label="SKJÓL"
      role="status"
      style={{
        position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(180deg,#F57A45 0%,#E0531C 100%)", color: "#FFFFFF",
        padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
        opacity: leaving ? 0 : 1, transition: "opacity .35s ease", pointerEvents: leaving ? "none" : "auto",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="112"
        height="112"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ filter: "drop-shadow(0 6px 14px rgba(120,40,0,0.35))" }}
      >
        <path d="M3 11h18" />
        <path d="M5 11v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        <path d="M1.5 11h2M20.5 11h2" />
        <path data-steam="1" d="M9 7.5c0-1.2.8-1.5.8-2.7" />
        <path data-steam="2" d="M12 7.5c0-1.2.8-1.5.8-2.7" />
        <path data-steam="3" d="M15 7.5c0-1.2.8-1.5.8-2.7" />
      </svg>
      <div style={{ marginTop: 22, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "0.16em", lineHeight: 1 }}>SKJÓL</span>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", color: "#FFE3D2" }}>App</span>
      </div>
      <div style={{ position: "relative", width: 168, height: 4, marginTop: 34, borderRadius: 2, overflow: "hidden", background: "rgba(255,255,255,0.28)" }}>
        <div data-loadbar="1" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "40%", borderRadius: 2, background: "#FFFFFF" }} />
      </div>
    </div>
  );
}
