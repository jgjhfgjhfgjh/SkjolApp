import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SKJÓL · Goods order",
    short_name: "SKJÓL",
    description: "Kitchen and bar record what ran out; Gústi buys it.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F4F2",
    theme_color: "#F4F4F2",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512m", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
