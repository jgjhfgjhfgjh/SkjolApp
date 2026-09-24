import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SKJÓL · Goods order",
  description: "Kitchen and bar record what ran out; Gústi buys it.",
  applicationName: "SKJÓL",
  appleWebApp: { capable: true, title: "SKJÓL", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/32", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/180",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4F4F2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
