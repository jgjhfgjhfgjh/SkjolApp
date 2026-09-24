import { T, type Lang } from "@/lib/i18n";
import { admin, checkManagerToken, pushConfigured, sendOne, subId } from "@/lib/server/push";

const CONFIRM: Record<Lang, string> = {
  en: "Notifications are on ✓ You'll get a ping for every new order.",
  is: "Kveikt á tilkynningum ✓ Þú færð tilkynningu um hverja nýja pöntun.",
  cs: "Upozornění jsou zapnutá ✓ Dáme vědět o každé nové objednávce.",
  pl: "Powiadomienia włączone ✓ Dostaniesz znać o każdym nowym zamówieniu.",
};

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
  const lang = (LANGS.includes(body.lang || "") ? body.lang : "en") as Lang;
  const db = admin();
  const id = subId(s.endpoint);
  const { data: existing } = await db.from("push_subs").select("id").eq("id", id).maybeSingle();
  const { error } = await db
    .from("push_subs")
    .upsert({ id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, role: "manager", lang, created_at: Date.now() });
  if (error) return Response.json({ ok: false, error: "db" }, { status: 500 });
  // First registration of this device: send a confirmation, which also proves delivery works end to end.
  if (!existing) {
    try {
      await sendOne({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, {
        title: "SKJÓL · " + T[lang].tabBuy, body: CONFIRM[lang], url: "/#buy", tag: "push-on",
      });
    } catch {
      return Response.json({ ok: false, error: "delivery" }, { status: 502 });
    }
  }
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
