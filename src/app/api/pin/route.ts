import { createHash, timingSafeEqual } from "node:crypto";
import { managerToken } from "@/lib/server/push";

// Manager code lives only on the server (env MANAGER_PIN). Default 1234 as in the prototype.
const digest = (s: string) => createHash("sha256").update("skjol:" + s).digest();

export async function POST(req: Request) {
  let pin = "";
  try {
    pin = String((await req.json())?.pin ?? "");
  } catch {}
  const expected = process.env.MANAGER_PIN || "1234";
  const ok = /^\d{4}$/.test(pin) && timingSafeEqual(digest(pin), digest(expected));
  if (!ok) await new Promise((r) => setTimeout(r, 400)); // slow down guessing
  // The token lets this device register for "new order" notifications.
  return Response.json(ok ? { ok, token: managerToken() } : { ok }, { headers: { "cache-control": "no-store" } });
}
