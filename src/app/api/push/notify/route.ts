import { T, type Lang } from "@/lib/i18n";
import { admin, pushConfigured, sendToManagers } from "@/lib/server/push";

// Called by a station right after it sent its list. The message is built from
// what is actually in the database (the latest send from that station within
// the last 2 minutes), so a caller cannot make Gústi's phone say anything else.
export async function POST(req: Request) {
  if (!pushConfigured()) return Response.json({ ok: false, error: "not-configured" }, { status: 503 });
  let station = "";
  try {
    station = String((await req.json())?.station || "");
  } catch {}
  if (station !== "kitchen" && station !== "bar") return Response.json({ ok: false }, { status: 400 });

  const { data, error } = await admin()
    .from("lines")
    .select("sent_at,sent_by")
    .eq("status", "sent")
    .eq("station", station)
    .gte("sent_at", Date.now() - 2 * 60 * 1000)
    .order("sent_at", { ascending: false });
  if (error) return Response.json({ ok: false, error: "db" }, { status: 500 });
  const rows = (data || []) as { sent_at: number; sent_by: string }[];
  if (!rows.length) return Response.json({ ok: true, sent: 0 });
  const latest = rows[0].sent_at;
  const n = rows.filter((r) => r.sent_at === latest).length;
  const by = rows[0].sent_by || "—";

  const result = await sendToManagers((lang) => {
    const t = T[(lang as Lang) in T ? (lang as Lang) : "en"];
    const where = station === "bar" ? t.bar : t.kitchen;
    return {
      title: "SKJÓL · " + t.tabBuy,
      body: `${where}: ${n} ${n === 1 ? t.item : t.items} · ${by}`,
      url: "/#buy",
      tag: "order-" + station,
    };
  });
  return Response.json({ ok: true, ...result });
}
