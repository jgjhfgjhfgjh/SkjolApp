"use client";

import dynamic from "next/dynamic";

// Platform detection needs the browser, so render client-only (like the app).
const Install = dynamic(() => import("./Install"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100dvh", background: "#F4F4F2" }} />,
});

export default function InstallClient(props: { qr: string; url: string }) {
  return <Install {...props} />;
}
