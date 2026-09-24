import type { Metadata } from "next";
import QRCode from "qrcode";
import InstallClient from "@/components/InstallClient";

export const metadata: Metadata = { title: "Install · SKJÓL" };

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://skjolapp.vercel.app";

export default async function InstallPage() {
  const url = SITE + "/install";
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#2E2C33", light: "#FFFFFF" } });
  return (
    <>
      {/* Chrome fires this once, early — keep it for the Install button. */}
      <script
        dangerouslySetInnerHTML={{
          __html: "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bip=e;});",
        }}
      />
      <InstallClient qr={qr} url={url} />
    </>
  );
}
