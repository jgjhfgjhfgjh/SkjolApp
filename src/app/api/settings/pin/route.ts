import { canChangePin, checkManagerToken, managerToken, setPin, verifyPin } from "@/lib/server/pin";

// Changes Gústi's PIN. Needs this device's manager token AND the current PIN.
export async function POST(req: Request) {
  if (!canChangePin()) return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  let body: { token?: unknown; current?: unknown; next?: unknown } = {};
  try {
    body = await req.json();
  } catch {}
  const next = String(body.next ?? "");
  if (!/^\d{4}$/.test(next)) return Response.json({ ok: false, error: "format" }, { status: 400 });
  if (!(await checkManagerToken(body.token)) || !(await verifyPin(String(body.current ?? "")))) {
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ ok: false, error: "current" }, { status: 403 });
  }
  await setPin(next);
  return Response.json({ ok: true, token: await managerToken() }, { headers: { "cache-control": "no-store" } });
}
