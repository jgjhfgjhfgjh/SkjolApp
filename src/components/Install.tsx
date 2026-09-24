"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { LANGS, type Lang } from "@/lib/i18n";

// Install-page strings (item names and app strings live in lib/i18n).
const IT = {
  en: {
    title: "Install SKJÓL",
    sub: "Put the app on this phone's or tablet's home screen. No app store needed.",
    scan: "Scan with the phone or tablet camera",
    android: "Android · Chrome",
    ios: "iPhone & iPad · Safari",
    installBtn: "Install app",
    androidSteps: ["Open this page in Chrome", "Tap ⋮ (top right)", "Tap “Install app” or “Add to Home screen”"],
    iosSteps: ["Open this page in Safari", "Tap Share", "Tap “Add to Home Screen”, then “Add”"],
    iosNotSafari: "On iPhone and iPad the app can only be installed from Safari. Copy the link and open it in Safari.",
    copy: "Copy link",
    copied: "Link copied",
    installed: "The app is installed on this device.",
    done: "Done — the SKJÓL icon is now on your home screen.",
    openApp: "Open app",
    print: "Print",
    back: "Back to app",
    thisDevice: "This device",
    otherDevice: "Another phone or tablet",
  },
  is: {
    title: "Settu upp SKJÓL",
    sub: "Settu appið á heimaskjá símans eða spjaldtölvunnar. Engin app-verslun þarf.",
    scan: "Skannaðu með myndavél símans eða spjaldtölvunnar",
    android: "Android · Chrome",
    ios: "iPhone og iPad · Safari",
    installBtn: "Setja upp app",
    androidSteps: ["Opnaðu þessa síðu í Chrome", "Ýttu á ⋮ (efst til hægri)", "Ýttu á „Setja upp forrit“ eða „Bæta við heimaskjá“"],
    iosSteps: ["Opnaðu þessa síðu í Safari", "Ýttu á Deila", "Ýttu á „Bæta á heimaskjá“ og svo „Bæta við“"],
    iosNotSafari: "Á iPhone og iPad er aðeins hægt að setja appið upp úr Safari. Afritaðu hlekkinn og opnaðu hann í Safari.",
    copy: "Afrita hlekk",
    copied: "Hlekkur afritaður",
    installed: "Appið er uppsett á þessu tæki.",
    done: "Búið — SKJÓL táknið er komið á heimaskjáinn.",
    openApp: "Opna appið",
    print: "Prenta",
    back: "Aftur í appið",
    thisDevice: "Þetta tæki",
    otherDevice: "Annar sími eða spjaldtölva",
  },
  cs: {
    title: "Instalace SKJÓL",
    sub: "Přidejte aplikaci na plochu telefonu nebo tabletu. Žádný obchod s aplikacemi není potřeba.",
    scan: "Naskenujte fotoaparátem telefonu nebo tabletu",
    android: "Android · Chrome",
    ios: "iPhone a iPad · Safari",
    installBtn: "Instalovat aplikaci",
    androidSteps: ["Otevřete tuto stránku v Chromu", "Ťukněte na ⋮ (vpravo nahoře)", "Ťukněte na „Instalovat aplikaci“ nebo „Přidat na plochu“"],
    iosSteps: ["Otevřete tuto stránku v Safari", "Ťukněte na Sdílet", "Ťukněte na „Přidat na plochu“ a pak „Přidat“"],
    iosNotSafari: "Na iPhonu a iPadu jde aplikaci nainstalovat jen ze Safari. Zkopírujte odkaz a otevřete ho v Safari.",
    copy: "Kopírovat odkaz",
    copied: "Odkaz zkopírován",
    installed: "Aplikace je na tomto zařízení nainstalovaná.",
    done: "Hotovo — ikona SKJÓL je na ploše.",
    openApp: "Otevřít aplikaci",
    print: "Tisk",
    back: "Zpět do aplikace",
    thisDevice: "Toto zařízení",
    otherDevice: "Další telefon nebo tablet",
  },
  pl: {
    title: "Zainstaluj SKJÓL",
    sub: "Dodaj aplikację do ekranu głównego telefonu lub tabletu. Sklep z aplikacjami nie jest potrzebny.",
    scan: "Zeskanuj aparatem telefonu lub tabletu",
    android: "Android · Chrome",
    ios: "iPhone i iPad · Safari",
    installBtn: "Zainstaluj aplikację",
    androidSteps: ["Otwórz tę stronę w Chrome", "Dotknij ⋮ (w prawym górnym rogu)", "Dotknij „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”"],
    iosSteps: ["Otwórz tę stronę w Safari", "Dotknij Udostępnij", "Dotknij „Do ekranu początkowego”, potem „Dodaj”"],
    iosNotSafari: "Na iPhonie i iPadzie aplikację można zainstalować tylko z Safari. Skopiuj link i otwórz go w Safari.",
    copy: "Kopiuj link",
    copied: "Link skopiowany",
    installed: "Aplikacja jest zainstalowana na tym urządzeniu.",
    done: "Gotowe — ikona SKJÓL jest na ekranie głównym.",
    openApp: "Otwórz aplikację",
    print: "Drukuj",
    back: "Wróć do aplikacji",
    thisDevice: "To urządzenie",
    otherDevice: "Inny telefon lub tablet",
  },
} satisfies Record<Lang, unknown>;

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global {
  interface Window {
    __bip?: BIP;
  }
}

type Platform = "ios-safari" | "ios-other" | "android" | "desktop";

function detect(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram/.test(ua) ? "ios-other" : "ios-safari";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function initialLang(): Lang {
  try {
    const p = JSON.parse(localStorage.getItem("skjol.ui.v1") || "null");
    if (p?.lang && p.lang in IT) return p.lang;
  } catch {}
  const n = (navigator.language || "").slice(0, 2).toLowerCase();
  return n === "is" || n === "cs" || n === "pl" ? n : "en";
}

const card: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #ECECEF",
  borderRadius: 20,
  padding: "20px 18px",
  boxShadow: "0 1px 0 #FFFFFF inset,0 1px 2px rgba(23,26,31,0.06),0 6px 14px -4px rgba(23,26,31,0.10),0 22px 40px -22px rgba(23,26,31,0.30)",
};
const kicker: CSSProperties = { fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6C6C70" };
const primary: CSSProperties = {
  border: 0, background: "#FF7A18", color: "#1C0D02", fontSize: 17, fontWeight: 700, minHeight: 56, borderRadius: 12, width: "100%",
  boxShadow: "0 1px 0 rgba(255,255,255,0.3) inset,0 6px 16px -6px rgba(200,80,10,0.5)",
};

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ verticalAlign: "-4px" }}>
    <path d="M12 3v12" />
    <path d="M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);

function Steps({ title, steps, active, share }: { title: string; steps: string[]; active?: boolean; share?: boolean }) {
  return (
    <div style={{ ...card, border: active ? "2px solid #FF7A18" : card.border }}>
      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: "#2E2C33" }}>{title}</div>
      <ol style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 15.5, lineHeight: 1.4, color: "#2E2C33" }}>
            <span style={{ flex: "none", width: 26, height: 26, borderRadius: "50%", background: "#FDEBE2", color: "#C24A00", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
            <span style={{ paddingTop: 2 }}>
              {s}
              {share && i === 1 && <> <ShareIcon /></>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Install({ qr, url }: { qr: string; url: string }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [platform] = useState<Platform>(detect);
  const [standalone] = useState(
    () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
  );
  const [bip, setBip] = useState<BIP | null>(() => window.__bip || null);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = IT[lang];

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BIP);
    };
    const onInstalled = () => {
      setInstalled(true);
      setBip(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  async function install() {
    if (!bip) return;
    await bip.prompt();
    const { outcome } = await bip.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setBip(null);
    window.__bip = undefined;
  }

  function copy() {
    navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => {},
    );
    setTimeout(() => setCopied(false), 2000);
  }

  const android = <Steps key="a" title={t.android} steps={t.androidSteps} active={platform === "android"} />;
  const ios = <Steps key="i" title={t.ios} steps={t.iosSteps} active={platform === "ios-safari" || platform === "ios-other"} share />;
  const guides = platform === "android" ? [android, ios] : [ios, android];

  // What this device should do right now.
  let action: React.ReactNode = null;
  if (standalone || installed) {
    action = (
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 30, lineHeight: 1 }}>✓</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 10, color: "#2E2C33" }}>{installed ? t.done : t.installed}</div>
        <Link href="/" style={{ ...primary, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 16, textDecoration: "none" }}>{t.openApp}</Link>
      </div>
    );
  } else if (platform === "android" && bip) {
    action = (
      <button onClick={install} style={primary}>
        {t.installBtn}
      </button>
    );
  } else if (platform === "ios-other") {
    action = (
      <div style={{ ...card, background: "#FFF1E3", border: "1px solid #FFC489" }}>
        <div style={{ fontSize: 15, lineHeight: 1.45, color: "#8A3F00" }}>{t.iosNotSafari}</div>
        <button onClick={copy} style={{ ...primary, marginTop: 14 }}>{copied ? t.copied : t.copy}</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F4F2", padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "12px 16px 40px" }}>
        <div data-noprint="1" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.14em", color: "#2E2C33", textDecoration: "none" }}>SKJÓL</Link>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 2, background: "#E9E9E6", borderRadius: 10, padding: 3 }}>
            {LANGS.map(([code, label]) => {
              const on = lang === code;
              return (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  style={{
                    border: 0, borderRadius: 8, minWidth: 42, minHeight: 36, padding: "0 8px", fontSize: 13, fontWeight: 700, letterSpacing: "0.04em",
                    boxShadow: on ? "0 1px 2px rgba(23,26,31,0.12),0 2px 6px -2px rgba(23,26,31,0.18)" : "none",
                    background: on ? "#FFFFFF" : "transparent", color: on ? "#141218" : "#6C6C70",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG route, nothing to optimise */}
          <img src="/icons/192" alt="" width={56} height={56} style={{ borderRadius: 14, flex: "none", boxShadow: "0 4px 12px -4px rgba(180,70,20,0.45)" }} />
          <h1 style={{ margin: 0, fontSize: "clamp(26px,7vw,34px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, color: "#2E2C33" }}>{t.title}</h1>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.45, color: "#6C6C70" }}>{t.sub}</p>

        {action && (
          <div data-noprint="1" style={{ marginTop: 20 }}>
            <div style={{ ...kicker, padding: "0 2px 8px" }}>{t.thisDevice}</div>
            {action}
          </div>
        )}

        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>{guides}</div>

        <div style={{ ...card, marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={kicker}>{t.otherDevice}</div>
          <div data-qr="1" aria-label={url} role="img" style={{ width: "min(240px,70vw)", aspectRatio: "1", marginTop: 14 }} dangerouslySetInnerHTML={{ __html: qr }} />
          <div style={{ fontSize: 14, color: "#6C6C70", marginTop: 12 }}>{t.scan}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#2E2C33", marginTop: 4, wordBreak: "break-all" }}>{url.replace(/^https?:\/\//, "")}</div>
        </div>

        <div data-noprint="1" style={{ display: "flex", gap: 9, marginTop: 16 }}>
          <button onClick={() => window.print()} style={{ flex: 1, border: "1px solid #C7C7C2", background: "transparent", minHeight: 46, borderRadius: 10, fontSize: 14, fontWeight: 600 }}>{t.print}</button>
          <Link href="/" style={{ flex: 1, border: "1px solid #C7C7C2", minHeight: 46, borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#2E2C33", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>{t.back}</Link>
        </div>
      </div>
    </div>
  );
}
