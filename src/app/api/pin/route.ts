import { managerToken, verifyPin } from "@/lib/server/pin";

// Checks Gústi's PIN (hash in the database, or MANAGER_PIN until it is changed).
export async function POST(req: Request) {
  let pin = "";
  try {
    pin = String((await req.json())?.pin ?? "");
  } catch {}
  const ok = await verifyPin(pin);
  if (!ok) await new Promise((r) => setTimeout(r, 400)); // slow down guessing
  // The token lets this device register for notifications and change settings.
  return Response.json(ok ? { ok, token: await managerToken() } : { ok }, { headers: { "cache-control": "no-store" } });
}
