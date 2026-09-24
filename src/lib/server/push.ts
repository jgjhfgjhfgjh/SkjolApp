import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const pushConfigured = () =>
  !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);

// Service-role client: bypasses RLS, never shipped to the browser.
export function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export { checkManagerToken, managerToken } from "./pin";

export const subId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

export type SubRow = { id: string; endpoint: string; p256dh: string; auth: string; lang: string };

const vapid = () =>
  webpush.setVapidDetails("https://skjolapp.vercel.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

// One notification to one device (e.g. the "notifications are on" confirmation).
export async function sendOne(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: object) {
  vapid();
  await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 600, urgency: "high" });
}

// Sends to every manager device; drops subscriptions the push service says are gone.
export async function sendToManagers(build: (lang: string) => { title: string; body: string; url: string; tag: string }) {
  vapid();
  const db = admin();
  const { data, error } = await db.from("push_subs").select("id,endpoint,p256dh,auth,lang").eq("role", "manager");
  if (error) throw error;
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    ((data || []) as SubRow[]).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(build(s.lang)),
          { TTL: 60 * 60 * 12, urgency: "high" },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id);
      }
    }),
  );
  if (gone.length) await db.from("push_subs").delete().in("id", gone);
  return { sent, removed: gone.length };
}
