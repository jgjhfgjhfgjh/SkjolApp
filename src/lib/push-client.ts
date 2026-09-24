// Browser side of Web Push for the manager's device.
const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const TOKEN = "skjol.mgrtoken";

export type PushState = "hidden" | "needs-install" | "denied" | "off" | "on";

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export function saveManagerToken(t: string | undefined) {
  try {
    if (t) localStorage.setItem(TOKEN, t);
  } catch {}
}
export const managerTokenValue = () => token();
const token = () => {
  try {
    return localStorage.getItem(TOKEN) || "";
  } catch {
    return "";
  }
};

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) || navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

async function save(sub: PushSubscription, lang: string) {
  const r = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: token(), subscription: sub.toJSON(), lang }),
  });
  if (!r.ok) throw new Error("subscribe " + r.status);
}

// Current state; when already subscribed, re-saves it so the server has the current language.
export async function pushState(lang: string): Promise<PushState> {
  if (!KEY) return "hidden";
  try {
    const r = await fetch("/api/push/subscribe", { cache: "no-store" });
    if (!(await r.json()).configured) return "hidden";
  } catch {
    return "hidden";
  }
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIOS() && !standalone() ? "needs-install" : "hidden";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub && Notification.permission === "granted") {
      save(sub, lang).catch(() => {});
      return "on";
    }
  } catch {}
  return "off";
}

// Must run from a tap (iOS only allows the permission prompt on a user gesture).
export async function enablePush(lang: string): Promise<PushState> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
  await save(sub, lang);
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe();
  }
  return "off";
}

// Fire-and-forget ping after a station's send has reached the database.
export function notifyManagers(station: string) {
  if (!KEY) return;
  fetch("/api/push/notify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ station }), keepalive: true }).catch(() => {});
}
