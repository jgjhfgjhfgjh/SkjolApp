"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import Splash from "./Splash";

// The whole app lives in the browser (device prefs in localStorage, live data
// from Supabase), so it is rendered client-only to avoid hydration mismatches.
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => <Splash />,
});

export default function ClientApp() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
  }, []);
  return <App />;
}
