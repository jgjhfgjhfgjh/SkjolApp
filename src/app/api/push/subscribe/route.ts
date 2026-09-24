import { admin, checkManagerToken, pushConfigured, subId } from "@/lib/server/push";

const LANGS = ["en", "is", "cs", "pl"];

// Lets the client hide the notifications panel until the server keys are set.
export async function GET() {
  return Response.json({ configured: pushConfigured() }, { headers: { "cache-control": "no-store" } });
}

// Registers this device for "new order" notifications. Manager devices only.
export async function POST(req: Request) {
  if (!pushConfigured()) return Response.json({ ok: false, error: "not-configured" }, { status: 503 });
  let body: { token?: unknown; subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; lang?: string } = {};
  try {
    body = await req.json();
  } catch {}
  if (!checkManagerToken(body.token)) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  const s = body.subscription;
  if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth || !/^https:\/\//.test(s.endpoint)) {
    return Response.json({ ok: false, error: "bad-subscription" }, { status: 400 });
  }
  const { error } = await admin()
    .from("push_subs")
    .upsert({
      id: subId(s.endpoint), endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, role: "manager",
      lang: LANGS.includes(body.lang || "") ? body.lang : "en", created_at: Date.now(),
    });
  if (error) return Response.json({ ok: false, error: "db" }, { status: 500 });
  return Response.json({ ok: true });
}

// Unsubscribe: knowing the endpoint is enough (it is a capability URL).
export async function DELETE(req: Request) {
  if (!pushConfigured()) return Response.json({ ok: false }, { status: 503 });
  let endpoint = "";
  try {
    endpoint = String((await req.json())?.endpoint || "");
  } catch {}
  if (!endpoint) return Response.json({ ok: false }, { status: 400 });
  await admin().from("push_subs").delete().eq("id", subId(endpoint));
  return Response.json({ ok: true });
}
