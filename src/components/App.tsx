"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import {
  ITEMS,
  ITEM_BY_ID,
  QUICK,
  ROLESRC,
  SHOPS,
  UNITKEYS,
  shopById,
  type Item,
  type Role,
  type Station,
  type Unit,
} from "@/lib/catalog";
import { LANGS, T, type Lang } from "@/lib/i18n";
import { getStore, useStore } from "@/lib/store/store";
import type { HistLine, LineRow, PrefRow } from "@/lib/store/types";

// ---------- device-local UI state (never shared) ----------
type UI = {
  role: Role | null;
  tab: "order" | "fav" | "history" | "buy";
  lang: Lang;
  scope: string;
  cat: string | null;
  view: "list" | "grid";
  filter: "todo" | "all" | "done";
  groupSupplier: boolean;
  showHidden: boolean;
  buySrc: string | null;
  author: string;
  nameErr: boolean;
  namePrompt: boolean;
  query: string;
  newItem: string;
  newSrc: string | null;
  newCat: string | null;
  expanded: string | null;
  swiped: string | null;
  swipeDir: "L" | "R" | null;
  peek: "L" | "R" | null;
  editing: string | null;
  editText: string;
  shopPick: string | null;
  openHist: string | null;
  toast: string | null;
  pinOpen: boolean;
  pin: string;
  pinErr: boolean;
  addOpen: boolean;
  searchOpen: boolean;
  qtyEdit: { id: string; text: string } | null;
};

const UI_KEY = "skjol.ui.v1";
const PERSIST: (keyof UI)[] = ["role", "tab", "lang", "scope", "view", "filter", "groupSupplier", "buySrc"];

function loadUI(): UI {
  const def: UI = {
    role: null, tab: "order", lang: "en", scope: "all", cat: null, view: "list", filter: "todo",
    groupSupplier: false, showHidden: false, buySrc: null, author: "", nameErr: false, namePrompt: false,
    query: "", newItem: "", newSrc: null, newCat: null, expanded: null, swiped: null, swipeDir: null,
    peek: null, editing: null, editText: "", shopPick: null, openHist: null, toast: null,
    pinOpen: false, pin: "", pinErr: false, addOpen: false, searchOpen: false, qtyEdit: null,
  };
  try {
    const p = JSON.parse(localStorage.getItem(UI_KEY) || "null");
    if (p) {
      Object.assign(def, p);
      // The manager must re-enter the PIN after a reload; stations re-enter their name.
      if (def.role === "manager") def.role = null;
      def.namePrompt = def.role === "kitchen" || def.role === "bar";
    }
  } catch {}
  return def;
}

const INSTALL_LABEL: Record<Lang, string> = {
  en: "Install on this device",
  is: "Setja upp á tækinu",
  cs: "Instalovat do zařízení",
  pl: "Zainstaluj na urządzeniu",
};
const SHARE_LABEL: Record<Lang, string> = { en: "Share", is: "Deila", cs: "Sdílet", pl: "Udostępnij" };
const SHARE_TEXT: Record<Lang, string> = {
  en: "Install the SKJÓL goods-order app on your phone or tablet:",
  is: "Settu upp SKJÓL vörupöntunarappið á símann eða spjaldtölvuna:",
  cs: "Nainstaluj si aplikaci SKJÓL na objednávky zboží do telefonu nebo tabletu:",
  pl: "Zainstaluj aplikację SKJÓL do zamawiania towaru na telefonie lub tablecie:",
};
// Installed PWA (home-screen icon) — hide the install link there.
const standalone =
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

const SWW = 144;
const pad2 = (n: number) => (n < 10 ? "0" : "") + n;
const shadowCard = "0 1px 2px rgba(23,26,31,0.05),0 6px 16px -8px rgba(23,26,31,0.14)";
const gateCardShadow =
  "0 1px 0 #FFFFFF inset,0 1px 2px rgba(23,26,31,0.06),0 6px 14px -4px rgba(23,26,31,0.10),0 22px 40px -22px rgba(23,26,31,0.30)";
const tab: CSSProperties = { fontVariantNumeric: "tabular-nums" };

async function sha(s: string) {
  try {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("skjol:" + s));
    return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {}
}

function Langs({ big, lang, onLang }: { big?: boolean; lang: Lang; onLang: (l: Lang) => void }) {
return (
  <div style={{ display: "flex", gap: 2, background: "#E9E9E6", borderRadius: big ? 10 : 9, padding: 3, marginLeft: big ? undefined : "auto" }}>
    {LANGS.map(([code, label]) => {
      const on = lang === code;
      return (
        <button
          key={code}
          onClick={() => onLang(code)}
          style={{
            border: 0, borderRadius: big ? 8 : 7, minWidth: big ? 42 : 36, minHeight: big ? 36 : 32, padding: big ? "0 8px" : "0 7px",
            fontSize: big ? 13 : 12, fontWeight: 700, letterSpacing: "0.04em",
            boxShadow: on ? "0 1px 2px rgba(23,26,31,0.12),0 2px 6px -2px rgba(23,26,31,0.18)" : "none",
            background: on ? "#FFFFFF" : "transparent", color: on ? "#141218" : "#6C6C70",
          }}
        >
          {label}
        </button>
      );
    })}
  </div>
);
}

function SectionHead({ name, meta, pad = "24px 2px 8px" }: { name: string; meta?: string; pad?: string }) {
return (
  <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: pad }}>
    <div style={{ ...tab, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>{name}</div>
    <div style={{ flex: 1, height: 1, background: "#E0E0DB" }} />
    {meta !== undefined && <div style={{ ...tab, fontSize: 11.5, color: "#606060" }}>{meta}</div>}
  </div>
);
}

function Chevron({ bg }: { bg: string }) {
return (
  <div data-garrow="1" style={{ flex: "none", width: 44, height: 44, borderRadius: "50%", background: bg, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  </div>
);
}

export default function App() {
  const db = useStore();
  const store = getStore();
  const [S, setRaw] = useState<UI>(loadUI);
  const set = (p: Partial<UI> | ((s: UI) => Partial<UI> | null)) =>
    setRaw((s) => {
      const r = typeof p === "function" ? p(s) : p;
      return r ? { ...s, ...r } : s;
    });

  const pinRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const npRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sw = useRef<{ id: string; x: number; y: number; el: HTMLElement; moved: boolean; dir: "h" | "v" | null; nx?: number } | null>(null);

  // persist device prefs
  useEffect(() => {
    try {
      const o: Partial<UI> = {};
      PERSIST.forEach((k) => ((o as Record<string, unknown>)[k] = S[k]));
      localStorage.setItem(UI_KEY, JSON.stringify(o));
    } catch {}
  }, [S]);

  useEffect(() => {
    document.documentElement.lang = S.lang;
  }, [S.lang]);

  // name prompt autofocus (opens the phone keyboard)
  const npOpen = (S.role === "kitchen" || S.role === "bar") && S.namePrompt;
  useEffect(() => {
    if (npOpen) setTimeout(() => npRef.current?.focus(), 80);
  }, [npOpen]);

  // "#buy" deep link (the manager's "Copy link") opens the PIN screen
  useEffect(() => {
    if (location.hash === "#buy") {
      window.history.replaceState(null, "", location.pathname);
      openPin();
    }
    return () => clearTimeout(toastTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = T[S.lang] || T.en;
  const flash = (m: string) => {
    set({ toast: m });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => set({ toast: null }), 2000);
  };

  // ---------- shared data, derived ----------
  const prefs = useMemo(() => {
    const m: Record<string, PrefRow> = {};
    db.item_prefs.forEach((p) => (m[p.id] = p));
    return m;
  }, [db.item_prefs]);
  const custom: Item[] = useMemo(
    () =>
      [...db.custom_items]
        .sort((a, b) => a.created_at - b.created_at)
        .map((c) => ({ id: c.id, name: c.name, hint: "", cat: c.cat, src: c.src, isCustom: true })),
    [db.custom_items],
  );
  const item = (id: string): Item | null => ITEM_BY_ID[id] || custom.find((c) => c.id === id) || null;
  const nameOf = (it: Item | null) => (it && (prefs[it.id]?.rename || it.name)) || "";
  const srcOf = (it: Item | null) => (it && (prefs[it.id]?.src_override || it.src)) || "other";
  const isHidden = (id: string) => !!prefs[id]?.hidden;

  const role = S.role;
  const isKitchen = role === "kitchen", isBar = role === "bar", isManager = role === "manager";
  const isEntry = isKitchen || isBar;
  const station = isEntry ? (role as Station) : null;
  const allowed = station ? ROLESRC[station] : null;

  const draft = useMemo(() => {
    const d: Record<string, LineRow> = {};
    db.lines.forEach((l) => {
      if (l.status === "draft" && l.station === station) d[l.item_id] = l;
    });
    return d;
  }, [db.lines, station]);
  const draftCount = (st: Station) => db.lines.filter((l) => l.status === "draft" && l.station === st).length;

  const sentLines = useMemo(
    () =>
      db.lines
        .filter((l) => l.status === "sent")
        .sort((a, b) => (a.sent_at || 0) - (b.sent_at || 0) || a.id.localeCompare(b.id)),
    [db.lines],
  );
  const order = useMemo(() => {
    if (!sentLines.length) return null;
    const lines: Record<string, LineRow> = {};
    let at = 0, by = "—";
    sentLines.forEach((l) => {
      lines[l.item_id] = l;
      if ((l.sent_at || 0) >= at) {
        at = l.sent_at || 0;
        by = l.sent_by || "—";
      }
    });
    return { at, by, lines };
  }, [sentLines]);

  const history = useMemo(() => [...db.history].sort((a, b) => b.closed_at - a.closed_at), [db.history]);
  const { counts, lastQty } = useMemo(() => {
    const counts: Record<string, number> = {};
    const lastQty: Record<string, { qty: number; unit: string }> = {};
    history.forEach((h) =>
      h.lines.forEach((l) => {
        counts[l.id] = (counts[l.id] || 0) + 1;
        if (!lastQty[l.id]) lastQty[l.id] = { qty: l.qty, unit: l.unit };
      }),
    );
    return { counts, lastQty };
  }, [history]);
  const favs = useMemo(() => {
    const f: Record<string, true> = {};
    db.favs.forEach((r) => {
      if (r.station === station) f[r.item_id] = true;
    });
    return f;
  }, [db.favs, station]);

  // ---------- formatting ----------
  const longDate = (ts: number) => {
    const d = new Date(ts);
    const day = d.getDate(), mon = t.months[d.getMonth()], wd = t.days[d.getDay()];
    if (S.lang === "cs" || S.lang === "is") return wd + " " + day + ". " + mon;
    return wd + ", " + day + " " + mon;
  };
  const fmt = (ts: number) => {
    const d = new Date(ts);
    const date = S.lang === "en" || S.lang === "pl" ? d.getDate() + " " + t.monthsShort[d.getMonth()] : d.getDate() + ". " + t.monthsShort[d.getMonth()];
    return date + " · " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  };
  const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);
  const unitLabel = (u: string) => (t.units as Record<string, string>)[u] || u;
  const catLabel = (c: string) => (c === "Other" ? t.otherCat : c);

  // ---------- actions ----------
  function openPin() {
    set({ pinOpen: true, pin: "", pinErr: false });
    setTimeout(() => pinRef.current?.focus(), 60);
  }
  async function checkPin(v: string) {
    let ok = false;
    try {
      const r = await fetch("/api/pin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin: v }) });
      ok = r.ok && (await r.json()).ok === true;
      if (ok) localStorage.setItem("skjol.mgr", await sha(v));
    } catch {
      // offline: accept the last code verified on this device
      try {
        ok = !!v && localStorage.getItem("skjol.mgr") === (await sha(v));
      } catch {}
    }
    if (ok) set({ pinOpen: false, pin: "", role: "manager", tab: "buy" });
    else {
      set({ pin: "", pinErr: true });
      pinRef.current?.focus();
    }
  }
  function onPin(val: string) {
    const v = String(val || "").replace(/\D/g, "").slice(0, 4);
    set({ pin: v, pinErr: false });
    if (v.length === 4) setTimeout(() => checkPin(v), 140);
  }

  function needName() {
    if (!String(S.author || "").trim()) {
      set({ nameErr: true });
      flash(t.tName);
      const el = document.getElementById("name-field");
      if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - 130), behavior: "smooth" });
      setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 350);
      return true;
    }
    return false;
  }

  function setLine(id: string, patch: Partial<LineRow>) {
    if (!station || needName()) return;
    const cur: LineRow = draft[id] || {
      id: `d:${station}:${id}`, station, item_id: id, status: "draft", qty: 0, unit: "pcs", note: "", by: "",
      at: null, done: false, supplier: "", sent_at: null, sent_by: "",
    };
    const next = { ...cur, ...patch };
    if (!next.qty || next.qty <= 0) store.remove("lines", [cur.id]);
    else {
      next.by = next.by || S.author || "";
      store.upsert("lines", [next], 250);
    }
  }
  function setExpanded(id: string | null) {
    const prev = S.expanded;
    set({ expanded: id, qtyEdit: null });
    if (prev && prev !== id && draft[prev] && !draft[prev].at) store.upsert("lines", [{ ...draft[prev], at: Date.now() }], 250);
  }
  function bump(id: string, delta: number) {
    const cur = draft[id]?.qty || 0;
    setLine(id, { qty: Math.max(0, Math.round((cur + delta) * 100) / 100) });
    if (!cur && delta > 0 && S.author.trim()) setExpanded(id);
  }

  function setPref(id: string, patch: Partial<PrefRow>) {
    const next: PrefRow = { ...(prefs[id] || { id, rename: null, hidden: false, src_override: null }), ...patch };
    if (!next.rename && !next.hidden && !next.src_override) store.remove("item_prefs", [id]);
    else store.upsert("item_prefs", [next]);
  }
  function toggleFav(id: string) {
    if (!station) return;
    const on = !favs[id];
    if (on) store.upsert("favs", [{ id: `${station}:${id}`, station, item_id: id }]);
    else store.remove("favs", [`${station}:${id}`]);
    flash(on ? t.favRemove : t.favourites);
  }
  function commitEdit() {
    const id = S.editing, v = String(S.editText || "").trim();
    if (!id) return;
    const orig = item(id)?.name;
    setPref(id, { rename: !v || v === orig ? null : v });
    set({ editing: null, editText: "" });
  }
  function hideItem(it: Item) {
    if (draft[it.id]) store.remove("lines", [draft[it.id].id]);
    if (it.isCustom) {
      store.remove("custom_items", [it.id]);
      flash(t.actDelete);
    } else {
      setPref(it.id, { hidden: true });
      flash(t.actHide);
    }
    set({ swiped: null });
  }
  function setShop(id: string, sid: string) {
    const base = ITEM_BY_ID[id]?.src;
    if (ITEM_BY_ID[id]) setPref(id, { src_override: sid === base ? null : sid });
    else {
      const c = db.custom_items.find((x) => x.id === id);
      if (c) store.upsert("custom_items", [{ ...c, src: sid }]);
    }
    set({ shopPick: null });
  }

  function send() {
    const ids = Object.keys(draft);
    if (!ids.length || !station) return;
    if (needName()) return;
    const now = Date.now();
    const rows: LineRow[] = ids.map((id) => {
      const d = draft[id];
      const old = order?.lines[id];
      return {
        ...d, id: "s:" + id, status: "sent", qty: old ? old.qty + d.qty : d.qty, done: false,
        supplier: old?.supplier || "", sent_at: now, sent_by: S.author || "—",
      };
    });
    store.upsert("lines", rows);
    store.remove("lines", ids.map((id) => draft[id].id));
    set({ expanded: null });
    flash(t.tSent);
  }

  function toggleDone(id: string) {
    const l = order?.lines[id];
    if (l) store.upsert("lines", [{ ...l, done: !l.done }]);
  }

  function complete() {
    if (!order) return;
    const lines: HistLine[] = Object.keys(order.lines).map((id) => {
      const it = item(id), l = order.lines[id];
      return {
        id, name: it ? nameOf(it) : id, cat: it ? it.cat : "—", src: it ? srcOf(it) : "other",
        srcName: it ? shopById(srcOf(it))?.name || "—" : "—", qty: l.qty, unit: l.unit, note: l.note || "",
        by: l.by || order.by, done: !!l.done, station: l.station,
      };
    });
    const now = Date.now();
    store.upsert("history", [{ id: "h" + now, at: order.at, closed_at: now, by: order.by, lines }]);
    store.remove("lines", sentLines.map((l) => l.id));
    set({ buySrc: null });
    flash(t.tArchived);
  }

  function repeat(lines: HistLine[]) {
    if (!station) return;
    const mine = lines.filter((l) => item(l.id) && ROLESRC[station].includes(srcOf(item(l.id))));
    const now = Date.now();
    store.upsert(
      "lines",
      mine.map((l, i) => ({
        id: `d:${station}:${l.id}`, station, item_id: l.id, status: "draft" as const, qty: l.qty, unit: l.unit as Unit,
        note: l.note || "", by: S.author, at: now + i, done: false, supplier: "", sent_at: null, sent_by: "",
      })),
    );
    set({ tab: "order" });
    flash(t.tLoaded);
  }

  function addCustomItem() {
    const nm = String(S.newItem || "").trim();
    if (!nm || !station || needName()) return;
    const src = S.newSrc || (S.scope !== "all" ? S.scope : "other");
    const cat = S.newCat || "Other";
    const now = Date.now();
    const id = "c" + now.toString(36) + Math.random().toString(36).slice(2, 6);
    store.upsert("custom_items", [{ id, name: nm, cat, src, created_by: S.author, created_at: now }]);
    const prev = S.expanded;
    const rows: LineRow[] = [{
      id: `d:${station}:${id}`, station, item_id: id, status: "draft", qty: 1, unit: "pcs", note: "", by: S.author,
      at: now, done: false, supplier: "", sent_at: null, sent_by: "",
    }];
    if (prev && draft[prev] && !draft[prev].at) rows.push({ ...draft[prev], at: now - 1 });
    store.upsert("lines", rows);
    set({ newItem: "", expanded: id, cat: null, query: "", addOpen: false });
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 40);
    flash(t.tAdded);
  }

  function share() {
    copyText(location.origin + location.pathname + "#buy");
    flash(t.tLink);
  }

  // Native share sheet (WhatsApp, Messenger, SMS…) with the install link; copy as fallback.
  async function shareInstall() {
    const url = location.origin + "/install";
    if (navigator.share) {
      try {
        await navigator.share({ title: "SKJÓL", text: SHARE_TEXT[S.lang], url });
      } catch {
        // dismissed by the user — nothing to do
      }
      return;
    }
    copyText(url);
    flash(t.tLink);
  }

  // ---------- swipe ----------
  function swipeStart(id: string, e: RPointerEvent<HTMLDivElement>) {
    if (S.editing) return;
    sw.current = { id, x: e.clientX, y: e.clientY, el: e.currentTarget, moved: false, dir: null };
  }
  function swipeMove(e: RPointerEvent<HTMLDivElement>) {
    const w = sw.current;
    if (!w) return;
    const dx = e.clientX - w.x, dy = e.clientY - w.y;
    if (!w.dir) {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
      w.dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (w.dir !== "h") return;
    w.moved = true;
    const base = S.swiped === w.id ? (S.swipeDir === "R" ? SWW : -SWW) : 0;
    const nx = Math.max(-SWW - 16, Math.min(SWW + 16, base + dx));
    w.nx = nx;
    const tray = nx > 0 ? "R" : "L";
    if (S.peek !== tray) set({ peek: tray });
    w.el.style.transition = "none";
    w.el.style.transform = "translateX(" + nx + "px)";
  }
  function swipeEnd() {
    const w = sw.current;
    sw.current = null;
    if (!w) return;
    w.el.style.transition = "";
    if (!w.moved) {
      if (S.swiped) set({ swiped: null });
      return;
    }
    const nx = w.nx || 0;
    const dir = nx < -50 ? "L" : nx > 50 ? "R" : null;
    w.el.style.transform = "translateX(" + (dir === "L" ? -SWW : dir === "R" ? SWW : 0) + "px)";
    set({ swiped: dir ? w.id : null, swipeDir: dir, peek: dir });
  }

  // ---------- view model ----------
  const isFav = isEntry && S.tab === "fav";
  const isOrder = isEntry && (S.tab === "order" || isFav);
  const isBuy = isManager && S.tab === "buy";
  const isHistory = !!role && S.tab === "history";
  const q = S.query.trim().toLowerCase();
  const draftIds = Object.keys(draft);
  const allIds = order ? Object.keys(order.lines) : [];
  const doneCount = order ? allIds.filter((id) => order.lines[id].done).length : 0;
  const pendingCount = allIds.length - doneCount;
  const kitchenDraft = draftCount("kitchen");
  const barDraft = draftCount("bar");
  const hasName = !!String(S.author || "").trim();

  let universe = ITEMS.concat(custom);
  if (allowed) universe = universe.filter((i) => allowed.includes(srcOf(i)));
  const hiddenHere = universe.filter((i) => isHidden(i.id));
  if (!S.showHidden) universe = universe.filter((i) => !isHidden(i.id));
  let pool = universe;
  if (S.scope !== "all") pool = pool.filter((i) => srcOf(i) === S.scope);
  if (q) pool = pool.filter((i) => (nameOf(i) + " " + i.cat + " " + (shopById(srcOf(i))?.name || "")).toLowerCase().includes(q));

  const scopes = [{ id: "all", label: t.scopeAll }]
    .concat(
      SHOPS.filter((s) => !allowed || allowed.includes(s.id))
        .filter((s) => !s.adhoc || custom.some((c) => c.src === s.id))
        .map((s) => ({ id: s.id, label: s.name })),
    )
    .map((s) => {
      const on = S.scope === s.id;
      const n = s.id === "all" ? draftIds.length : draftIds.filter((id) => srcOf(item(id)) === s.id).length;
      return { key: s.id, label: n ? s.label + " · " + n : s.label, on, n, go: () => set({ scope: s.id, cat: null, expanded: null }) };
    });

  const showGridMode = isOrder && !isFav && !q && !S.cat && S.view === "grid";
  const catCards: { name: string; raw: string; count: string; picked: number }[] = [];
  if (showGridMode) {
    const cmap = new Map<string, Item[]>();
    pool.forEach((i) => {
      if (!cmap.has(i.cat)) cmap.set(i.cat, []);
      cmap.get(i.cat)!.push(i);
    });
    cmap.forEach((items, name) => {
      const picked = items.filter((i) => draft[i.id]).length;
      const shops = Array.from(new Set(items.map((i) => shopById(srcOf(i))?.name || "—")));
      catCards.push({
        name: catLabel(name), raw: name, picked,
        count: items.length + " · " + shops.slice(0, 2).join(", ") + (shops.length > 2 ? " +" + (shops.length - 2) : ""),
      });
    });
  }

  const orderGroups: { name: string; meta: string; items: Item[] }[] = [];
  if (isOrder && (isFav || q || S.cat || S.view === "list")) {
    if (S.cat) pool = pool.filter((i) => i.cat === S.cat);
    const map = new Map<string, Item[]>();
    if (isFav) {
      const starred = pool.filter((i) => favs[i.id]);
      const often = pool.filter((i) => !favs[i.id] && counts[i.id]).sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).slice(0, 12);
      if (starred.length) map.set("★ " + t.tabFav, starred);
      if (often.length) map.set(t.favOften, often);
    } else {
      let rest = pool;
      if (!q && !S.cat) {
        const isPinned = (i: Item) => !!draft[i.id] && !(S.expanded === i.id && !draft[i.id].at);
        const picked = pool.filter(isPinned).sort((a, b) => (draft[b.id].at || 0) - (draft[a.id].at || 0));
        if (picked.length) map.set(t.inOrder, picked);
        rest = pool.filter((i) => !isPinned(i));
      }
      rest.forEach((i) => {
        const k = S.cat ? shopById(srcOf(i))?.name || "—" : i.cat;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(i);
      });
    }
    map.forEach((items, name) => {
      const picked = items.filter((i) => draft[i.id]).length;
      orderGroups.push({ name: catLabel(name), meta: name === t.inOrder || !picked ? String(items.length) : picked + "/" + items.length, items });
    });
  }
  const draftSrcs = new Set(draftIds.map((id) => srcOf(item(id))));

  // manager board
  const bySrc: Record<string, string[]> = {};
  if (order) allIds.forEach((id) => {
    const it = item(id);
    if (!it) return;
    const k = srcOf(it);
    (bySrc[k] = bySrc[k] || []).push(id);
  });
  const pinned = S.buySrc && bySrc[S.buySrc] ? S.buySrc : null;
  const shopRank = (id: string) => {
    const i = SHOPS.findIndex((s) => s.id === id);
    return i < 0 ? SHOPS.length : i;
  };
  const srcKeys = Object.keys(bySrc).sort((a, b) => shopRank(a) - shopRank(b));
  const shopSeq = pinned ? [pinned].concat(srcKeys.filter((k) => k !== pinned)) : srcKeys;
  const supplierOptions = Array.from(new Set(sentLines.map((l) => l.supplier).filter(Boolean)));

  const padBottom = isOrder || (isBuy && order) ? 110 : 36;
  const fabBottom = isOrder || (isBuy && order) ? 96 : 24;

  // ---------- small render helpers ----------
  // ---------- GATE ----------
  if (!role) {
    const gateCard = (opts: {
      onClick: () => void; icon: React.ReactNode; tint: string; fg: string; title: string; badge: number; badgeBg: string;
      desc: React.ReactNode; extra?: React.ReactNode; arrow: string;
    }) => (
      <button
        onClick={opts.onClick}
        data-gcard="1"
        style={{
          minHeight: 0, border: "1px solid #ECECEF", background: "#FFFFFF", borderRadius: 20,
          padding: "clamp(14px,2.6vh,26px) clamp(16px,2.4vw,28px)", display: "flex", gap: "clamp(12px,1.8vw,20px)",
          overflow: "hidden", position: "relative", boxShadow: gateCardShadow,
        }}
      >
        <div
          data-gicon="1"
          style={{
            flex: "none", width: "clamp(52px,8vh,76px)", height: "clamp(52px,8vh,76px)", borderRadius: 18, background: opts.tint,
            color: opts.fg, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {opts.icon}
        </div>
        <div data-gtext="1" style={{ minWidth: 0, flex: "0 1 auto" }}>
          <div data-grow="1" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: "clamp(19px,2.8vh,28px)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.12, color: "#2E2C33" }}>{opts.title}</div>
            {opts.badge > 0 && (
              <div style={{ ...tab, fontSize: 12.5, fontWeight: 700, background: opts.badgeBg, color: "#FFFFFF", padding: "4px 9px", borderRadius: 7 }}>{opts.badge}</div>
            )}
          </div>
          <div data-gdesc="1" style={{ fontSize: "clamp(13px,1.8vh,15px)", color: "#6C6C70", marginTop: 5, lineHeight: 1.4 }}>{opts.desc}</div>
          {opts.extra}
        </div>
        <Chevron bg={opts.arrow} />
      </button>
    );
    const svgIcon = (children: React.ReactNode) => (
      <svg viewBox="0 0 24 24" style={{ width: "52%", height: "52%" }} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    );
    const pickStation = (r: Station) =>
      set({ role: r, tab: "order", scope: "all", cat: null, expanded: null, query: "", author: "", nameErr: false, namePrompt: true });

    return (
      <div style={{ minHeight: "100vh", background: "#F4F4F2" }}>
        {S.pinOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", animation: "rise .18s ease" }}>
            <button
              onClick={() => set({ pinOpen: false, pin: "", pinErr: false })}
              style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top))", left: 14, border: "1px solid #E0E0DB", background: "#FFFFFF", borderRadius: 20, padding: "0 14px", minHeight: 40, fontSize: 14, fontWeight: 600, color: "#4A4850" }}
            >
              ‹ {t.cancel}
            </button>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: "#2F6BB5", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>G</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.028em", marginTop: 18, color: "#2E2C33", textAlign: "center" }}>{t.pinTitle}</div>
            <div style={{ fontSize: 15, color: "#6E6B75", marginTop: 6, textAlign: "center" }}>{t.pinSub}</div>
            <div onClick={() => pinRef.current?.focus()} style={{ position: "relative", display: "flex", gap: 12, marginTop: 30, cursor: "text" }}>
              {[0, 1, 2, 3].map((i) => {
                const p = S.pin, filled = i < p.length, cur = i === p.length;
                return (
                  <div
                    key={i}
                    style={{
                      width: 64, height: 76, borderRadius: 14,
                      border: "2px solid " + (S.pinErr ? "#D93636" : cur ? "#F2622A" : filled ? "#2E2C33" : "#D8D6DC"),
                      background: filled ? "#FFFFFF" : "#F6F6F4", boxShadow: cur ? "0 0 0 4px rgba(242,98,42,0.18)" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 700, color: "#2E2C33",
                      transition: "border-color .12s,box-shadow .12s",
                    }}
                  >
                    {filled ? "•" : ""}
                  </div>
                );
              })}
              <input
                ref={pinRef}
                value={S.pin}
                onChange={(e) => onPin(e.target.value)}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={4}
                aria-label={t.pinSub}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, border: 0, fontSize: 16, caretColor: "transparent" }}
              />
            </div>
            <div style={{ marginTop: 16, fontSize: 14, fontWeight: 600, color: "#D93636", minHeight: 20, visibility: S.pinErr ? "visible" : "hidden" }}>{t.pinWrong}</div>
          </div>
        )}
        <div
          style={{
            height: "100dvh", overflow: "hidden", display: "flex", flexDirection: "column", width: "100%",
            padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
          }}
        >
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "12px clamp(16px,3vw,32px)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.14em", color: "#2E2C33" }}>SKJÓL</div>
            <div style={{ flex: 1 }} />
            <button
              onClick={shareInstall}
              aria-label={SHARE_LABEL[S.lang]}
              title={SHARE_LABEL[S.lang]}
              style={{ flex: "none", width: 42, height: 42, border: 0, borderRadius: 10, background: "#E9E9E6", color: "#2E2C33", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3v12" />
                <path d="M8 7l4-4 4 4" />
                <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
              </svg>
            </button>
            <Langs big lang={S.lang} onLang={(lang) => set({ lang })} />
          </div>
          <div style={{ flex: "none", padding: "clamp(4px,1.5vh,16px) clamp(16px,3vw,32px) clamp(12px,2.4vh,24px)" }}>
            <h1 style={{ margin: 0, fontSize: "clamp(26px,4vh,40px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, color: "#2E2C33" }}>{t.appKicker}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "6px 10px", flexWrap: "wrap", marginTop: 8, fontSize: 13, color: "#6C6C70" }}>
              <span style={{ fontWeight: 600, color: "#2E2C33" }}>1</span><span>{t.gS1}</span><span style={{ color: "#AEAEB2" }}>→</span>
              <span style={{ fontWeight: 600, color: "#2E2C33" }}>2</span><span>{t.gS2}</span><span style={{ color: "#AEAEB2" }}>→</span>
              <span style={{ fontWeight: 600, color: "#2E2C33" }}>3</span><span>{t.gS3}</span>
            </div>
          </div>
          <div data-ggrid="1" style={{ flex: 1, minHeight: 0, display: "grid", gap: "clamp(10px,1.6vh,18px)", padding: "0 clamp(16px,3vw,32px) clamp(14px,2.4vh,28px)" }}>
            {gateCard({
              onClick: () => pickStation("kitchen"), tint: "#FDEBE2", fg: "#F2622A", title: t.gOrderK, badge: kitchenDraft, badgeBg: "#F2622A",
              desc: t.gKWhat, arrow: "#F2622A",
              icon: svgIcon(<><path d="M3 11h18" /><path d="M5 11v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /><path d="M1.5 11h2M20.5 11h2" /><path d="M9 7.5c0-1.2.8-1.5.8-2.7M12 7.5c0-1.2.8-1.5.8-2.7M15 7.5c0-1.2.8-1.5.8-2.7" /></>),
            })}
            {gateCard({
              onClick: () => pickStation("bar"), tint: "#FDEBE2", fg: "#F2622A", title: t.gOrderB, badge: barDraft, badgeBg: "#F2622A",
              desc: t.gBWhat, arrow: "#F2622A",
              icon: svgIcon(<><path d="M4 4h16l-8 9z" /><path d="M12 13v7" /><path d="M8 20h8" /><path d="M15.5 4 18 1.5" /></>),
            })}
            {gateCard({
              onClick: openPin, tint: "#E9E9EC", fg: "#1C1C1E", title: t.gBuy, badge: pendingCount, badgeBg: "#1C1C1E", arrow: "#1C1C1E",
              desc: <>{t.manager} · {pendingCount ? plural(pendingCount, t.item, t.items) + " " + t.gWaiting : t.gNothing}</>,
              icon: svgIcon(<><path d="M2.5 3.5h2.6l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 7.5H6.1" /><circle cx="9.5" cy="20" r="1.4" /><circle cx="17.5" cy="20" r="1.4" /></>),
              extra: (
                <div data-grow="1" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, fontWeight: 600, color: "#6C6C70" }}>
                  <span style={{ position: "relative", width: 11, height: 13, display: "inline-block", flex: "none" }}>
                    <span style={{ position: "absolute", left: 2, top: 0, width: 7, height: 7, border: "1.6px solid currentColor", borderBottom: 0, borderRadius: "4px 4px 0 0", boxSizing: "border-box" }} />
                    <span style={{ position: "absolute", left: 0, bottom: 0, width: 11, height: 7, background: "currentColor", borderRadius: 2 }} />
                  </span>
                  {t.gLocked}
                </div>
              ),
            })}
          </div>
          <div style={{ ...tab, flex: "none", padding: "0 clamp(16px,3vw,32px) 10px", fontSize: 12, color: "#8E8E93", textAlign: "center" }}>
            {history.length ? t.lastOrder + " · " + fmt(history[0].closed_at) : t.noOrders}
            {db.mode === "local" && <span style={{ color: "#AEAEB2" }}> · offline demo</span>}
            {!standalone && (
              <>
                {" · "}
                <a href="/install" style={{ fontWeight: 600 }}>{INSTALL_LABEL[S.lang]}</a>
              </>
            )}
          </div>
        </div>
        {S.toast && (
          <div role="status" style={{ position: "fixed", left: 0, right: 0, margin: "0 auto", width: "fit-content", bottom: "calc(48px + env(safe-area-inset-bottom))", zIndex: 40, background: "#141218", color: "#FFFFFF", fontSize: 14.5, fontWeight: 500, padding: "13px 22px", borderRadius: 9, boxShadow: "0 4px 10px rgba(23,26,31,0.22),0 18px 40px -14px rgba(23,26,31,0.45)", animation: "rise .16s ease", maxWidth: "88vw", textAlign: "center" }}>
            {S.toast}
          </div>
        )}
      </div>
    );
  }

  // ---------- ROLE SCREENS ----------
  const tabDefs = isEntry
    ? [{ id: "order", label: t.tabOrder, count: draftIds.length }, { id: "fav", label: t.tabFav, count: 0 }, { id: "history", label: t.tabHist, count: 0 }]
    : [{ id: "buy", label: t.tabBuy, count: pendingCount }, { id: "history", label: t.tabHist, count: 0 }];

  const renderRow = (it: Item, i: number, items: Item[]) => {
    const l = draft[it.id], qty = l ? l.qty : 0, unit = l ? l.unit : "pcs";
    const last = lastQty[it.id];
    const open = S.expanded === it.id;
    const swiped = S.swiped === it.id;
    const subs: string[] = [];
    if (it.hint) subs.push(it.hint);
    if (l && l.note) subs.push(l.note);
    if (it.isCustom) subs.push(t.suggested);
    if (!l && last) subs.push(t.lastTime + " " + last.qty + " " + unitLabel(last.unit));
    if (l) subs.push(unitLabel(unit) + (l.by ? " · " + l.by : ""));
    const peeking = sw.current && sw.current.id === it.id;
    const leftShow = swiped ? S.swipeDir === "R" : !!peeking && S.peek === "R";
    const rightShow = swiped ? S.swipeDir === "L" : !!peeking && S.peek === "L";
    const fav = !!favs[it.id];
    const toggle = () => setExpanded(open ? null : it.id);
    const qtyText = S.qtyEdit && S.qtyEdit.id === it.id ? S.qtyEdit.text : qty ? String(qty) : "";
    const actBtn = (bg: string, onClick: () => void, icon: React.ReactNode, label: string) => (
      <button onClick={onClick} style={{ border: 0, width: 72, background: bg, color: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 4px" }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.1, textAlign: "center" }}>{label}</span>
      </button>
    );
    const chipBtn = (key: string, label: string, on: boolean, onClick: () => void, extra?: CSSProperties) => (
      <button
        key={key}
        onClick={onClick}
        style={{ border: "1px solid " + (on ? "#141218" : "#E0E0DB"), background: on ? "#141218" : "#fff", color: on ? "#FFFFFF" : "#141218", minHeight: 44, borderRadius: 8, ...extra }}
      >
        {label}
      </button>
    );
    return (
      <div key={it.id} style={{ position: "relative", borderBottom: i === items.length - 1 ? "none" : "1px solid #E9E9E5", overflow: "hidden" }}>
        {leftShow && (
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, display: "flex" }}>
            {actBtn("#C93400", () => { toggleFav(it.id); set({ swiped: null }); }, <span style={{ fontSize: 18, lineHeight: 1 }}>{fav ? "★" : "☆"}</span>, t.tabFav)}
            {actBtn("#0040DD", () => set((s) => ({ shopPick: s.shopPick === it.id ? null : it.id, swiped: null, expanded: null })), <span style={{ width: 15, height: 15, border: "1.8px solid #FFFFFF", borderRadius: 3 }} />, t.actShop)}
          </div>
        )}
        {rightShow && (
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, display: "flex" }}>
            {actBtn("#6C6C70", () => set({ editing: it.id, editText: nameOf(it), swiped: null }), <span style={{ width: 15, height: 15, border: "1.8px solid #FFFFFF", borderRadius: "50%" }} />, t.actEdit)}
            {actBtn("#D70015", () => hideItem(it), <span style={{ width: 15, height: 2, background: "#FFFFFF" }} />, it.isCustom ? t.actDelete : t.actHide)}
          </div>
        )}
        <div
          onPointerDown={(e) => swipeStart(it.id, e)}
          onPointerMove={swipeMove}
          onPointerUp={swipeEnd}
          onPointerCancel={swipeEnd}
          style={{
            position: "relative", background: qty > 0 ? "#FFF1E3" : "#FFFFFF", borderLeft: "4px solid " + (qty > 0 ? "#FF7A18" : "transparent"),
            boxShadow: qty > 0 ? "0 1px 2px rgba(23,26,31,0.10),0 6px 14px -8px rgba(181,77,15,0.35)" : "0 1px 2px -1px rgba(23,26,31,0.10)",
            transform: swiped ? (S.swipeDir === "R" ? `translateX(${SWW}px)` : `translateX(-${SWW}px)`) : "translateX(0px)",
            transition: "transform .22s cubic-bezier(.2,.8,.2,1)", touchAction: "pan-y",
          }}
        >
          {S.editing === it.id ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px 9px 12px", minHeight: 62, background: "#F7F7F5" }}>
              <input
                autoFocus
                value={S.editText}
                onChange={(e) => set({ editText: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                placeholder={t.renamePh}
                style={{ flex: 1, minWidth: 0, border: "1px solid #141218", background: "#FFFFFF", borderRadius: 8, padding: "0 12px", minHeight: 46, fontSize: 16 }}
              />
              <button onClick={() => set({ editing: null, editText: "" })} style={{ border: "1px solid #C7C7C2", background: "#FFFFFF", padding: "0 13px", minHeight: 46, borderRadius: 8, fontSize: 13.5, fontWeight: 500 }}>{t.cancel}</button>
              <button onClick={commitEdit} style={{ border: 0, background: "#141218", color: "#FFFFFF", padding: "0 16px", minHeight: 46, borderRadius: 8, fontSize: 13.5, fontWeight: 600 }}>{t.save}</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 9px 8px 12px", minHeight: 62 }}>
              <div
                onClick={toggle}
                style={{
                  flex: 1, minWidth: 0, cursor: "pointer", padding: "6px 0", maxWidth: swiped ? "calc(100% - 156px)" : "100%",
                  transform: swiped && S.swipeDir === "L" ? `translateX(${SWW}px)` : "none", transition: "transform .22s cubic-bezier(.2,.8,.2,1)",
                }}
              >
                <div style={{ fontSize: 16.5, letterSpacing: "-0.014em", lineHeight: 1.25, fontWeight: qty > 0 ? 600 : 400 }}>{nameOf(it)}</div>
                <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                  {!S.cat && (
                    <span style={{ ...tab, fontSize: 10.5, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: qty > 0 ? "#8A3F00" : "#5A5566", background: qty > 0 ? "#FFDCBC" : "#F2F2F0", padding: "3px 7px", borderRadius: 4 }}>
                      {shopById(srcOf(it))?.name || "—"}
                    </span>
                  )}
                  {isFav && counts[it.id] > 0 && (
                    <span style={{ ...tab, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", color: "#8A3F00", background: "#FFE7D0", padding: "3px 6px", borderRadius: 4 }}>{counts[it.id]}×</span>
                  )}
                  {subs.length > 0 && <span style={{ fontSize: 12.5, color: "#5A5566" }}>{subs.join(" · ")}</span>}
                </div>
              </div>
              {!swiped && (
                <>
                  <div style={{ display: "flex", alignItems: "center", flex: "none", border: "1px solid " + (qty > 0 ? "#FF7A18" : "#E0E0DB"), borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                    <button onClick={() => bump(it.id, -1)} aria-label="−" style={{ border: 0, background: "transparent", width: 46, height: 48, fontSize: 22, lineHeight: 1, color: qty > 0 ? "#141218" : "#BEBEB9" }}>−</button>
                    <input
                      value={qtyText}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v = parseFloat(String(raw).replace(",", "."));
                        if (!hasName) return void needName();
                        const was = !!draft[it.id];
                        setLine(it.id, { qty: isNaN(v) ? 0 : v });
                        if (!was && v > 0 && S.expanded !== it.id) setExpanded(it.id);
                        set({ qtyEdit: { id: it.id, text: raw } });
                      }}
                      onBlur={() => set({ qtyEdit: null })}
                      inputMode="decimal"
                      placeholder="0"
                      aria-label={nameOf(it)}
                      style={{
                        ...tab, width: 46, height: 48, border: 0, borderLeft: "1px solid #E4E4E0", borderRight: "1px solid #E4E4E0", background: "transparent",
                        textAlign: "center", fontSize: 17, fontWeight: 600, padding: 0, color: qty > 0 ? "#141218" : "#9A9A9A",
                      }}
                    />
                    <button onClick={() => bump(it.id, 1)} aria-label="+" style={{ border: 0, background: "transparent", width: 46, height: 48, fontSize: 22, lineHeight: 1, color: "#C24A00" }}>+</button>
                  </div>
                  <button
                    onClick={toggle}
                    style={{
                      flex: "none", border: "1px solid " + (open ? "#141218" : "#E0E0DB"), background: open ? "#141218" : "#fff", color: open ? "#FFFFFF" : "#5A5566",
                      width: 40, height: 48, borderRadius: 8, fontSize: 12, lineHeight: 1.1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: 0,
                    }}
                  >
                    <span style={{ ...tab, fontSize: 10, fontWeight: 600, letterSpacing: "0.02em" }}>{unitLabel(unit)}</span>
                    <span style={{ fontSize: 11 }}>{open ? "▴" : "▾"}</span>
                  </button>
                </>
              )}
            </div>
          )}
          {S.shopPick === it.id && (
            <div style={{ padding: "2px 12px 14px", background: "#F7F7F5", boxShadow: "inset 0 3px 8px -5px rgba(23,26,31,0.30)", animation: "rise .15s ease" }}>
              <div style={{ ...tab, fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "#606060", padding: "4px 0 8px" }}>{t.moveTo}</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {SHOPS.filter((sr) => !sr.adhoc).map((sr) => {
                  const on = srcOf(it) === sr.id;
                  return chipBtn(sr.id, sr.name, on, () => setShop(it.id, sr.id), { padding: "0 14px", fontSize: 14, fontWeight: on ? 600 : 500 });
                })}
              </div>
            </div>
          )}
          {open && (
            <div style={{ padding: "4px 12px 15px", background: "#F7F7F5", boxShadow: "inset 0 3px 8px -5px rgba(23,26,31,0.30)", animation: "rise .15s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0 7px" }}>
                <div style={{ ...tab, flex: 1, fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "#606060" }}>{t.quick}</div>
                <button
                  onClick={toggle}
                  style={{ border: 0, background: "#FF7A18", color: "#1C0D02", fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em", padding: "0 18px", minHeight: 38, borderRadius: 8, boxShadow: "0 1px 0 rgba(255,255,255,0.3) inset,0 3px 10px -4px rgba(200,80,10,0.5)" }}
                >
                  {t.ok}
                </button>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
                {QUICK.map((n) => chipBtn("q" + n, String(n), qty === n, () => setLine(it.id, { qty: n }), { ...tab, minWidth: 52, fontSize: 15, fontWeight: 600 }))}
                {last && (
                  <button
                    onClick={() => setLine(it.id, { qty: last.qty, unit: last.unit as Unit })}
                    style={{ border: "1px dashed #C7C7C2", background: "transparent", color: "#5A5566", padding: "0 14px", minHeight: 44, borderRadius: 8, fontSize: 13.5 }}
                  >
                    ↺ {t.lastTime} {last.qty} {unitLabel(last.unit)}
                  </button>
                )}
              </div>
              <div style={{ ...tab, fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "#606060", padding: "0 0 7px" }}>{t.unit}</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 13 }}>
                {UNITKEYS.map((u) => chipBtn("u" + u, unitLabel(u), unit === u && qty > 0, () => setLine(it.id, { unit: u, qty: qty || 1 }), { padding: "0 15px", fontSize: 14, fontWeight: 500 }))}
              </div>
              <input
                value={l ? l.note : ""}
                onChange={(e) => setLine(it.id, { note: e.target.value, qty: qty || 1 })}
                placeholder={t.notePh}
                style={{ width: "100%", border: "1px solid #E0E0DB", background: "#fff", borderRadius: 8, padding: "13px 13px", fontSize: 16 }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const fabOn = isOrder && !isFav && !S.searchOpen && !S.addOpen;
  const allowedShops = SHOPS.filter((x) => !x.adhoc && (!allowed || allowed.includes(x.id)));
  const addCats = (() => {
    const names: string[] = [];
    SHOPS.filter((x) => !allowed || allowed.includes(x.id)).forEach((x) => x.groups.forEach((g) => { if (!names.includes(g)) names.push(g); }));
    return names.filter((n) => n !== "Other").concat(["Other"]);
  })();

  return (
    <div style={{ minHeight: "100vh", background: "#F4F4F2" }}>
      <div style={{ paddingBottom: padBottom }}>
        {/* HEADER */}
        <header
          data-hdr="1"
          data-noprint="1"
          style={{
            position: "sticky", top: 0, zIndex: 30, background: "rgba(255,255,255,0.86)", backdropFilter: "saturate(180%) blur(18px)",
            WebkitBackdropFilter: "saturate(180%) blur(18px)", borderBottom: "1px solid #E0E0DB", boxShadow: "0 4px 14px -8px rgba(23,26,31,0.28)",
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <div style={{ width: "100%", padding: "11px 16px 0" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 11, minHeight: 38 }}>
              <button
                onClick={() => set({ role: null, expanded: null, query: "", cat: null, author: "", nameErr: false, swiped: null, addOpen: false, searchOpen: false })}
                style={{ border: "1px solid #E0E0DB", background: "#FFFFFF", borderRadius: 20, padding: "7px 13px 7px 10px", display: "flex", alignItems: "center", gap: 7, minHeight: 38 }}
              >
                <span style={{ fontSize: 15, color: "#5A5566", lineHeight: 1 }}>‹</span>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: isBar ? "#2E9B57" : isKitchen ? "#F2622A" : "#2F6BB5", flex: "none" }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{isBar ? t.bar : isKitchen ? t.kitchen : t.manager}</span>
              </button>
              <div style={{ flex: 1, minWidth: 8, textAlign: "center", overflow: "hidden", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.13em", color: "#5A5566", whiteSpace: "nowrap" }}>
                SKJÓL{!db.online && <span style={{ color: "#D93636", letterSpacing: 0 }}> ●</span>}
              </div>
              <Langs lang={S.lang} onLang={(lang) => set({ lang })} />
            </div>
            <nav style={{ display: "flex", gap: 4, padding: "6px 0 0" }}>
              {tabDefs.map((r) => {
                const on = r.id === S.tab;
                return (
                  <button
                    key={r.id}
                    onClick={() => set({ tab: r.id as UI["tab"], expanded: null, swiped: null })}
                    style={{
                      border: 0, background: "transparent", padding: "9px 2px 10px", marginRight: 16, fontSize: 16, fontWeight: on ? 700 : 500, letterSpacing: "-0.015em",
                      color: on ? "#141218" : "#5A5566", borderBottom: "2.5px solid " + (on ? "#FF7A18" : "transparent"), display: "flex", alignItems: "center", gap: 7,
                    }}
                  >
                    {r.label}
                    {r.count > 0 && (
                      <span style={{ ...tab, fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: isManager ? "#FF7A18" : "#141218", color: isManager ? "#1C0D02" : "#FFFFFF" }}>{r.count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* ORDER / FAVOURITES */}
        {isOrder && (
          <div style={{ width: "100%", padding: "0 16px" }}>
            <div style={{ padding: "20px 0 0", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 27, fontWeight: 700, letterSpacing: "-0.028em", lineHeight: 1 }}>{isFav ? t.tabFav : t.newOrder}</h1>
              <div style={{ fontSize: 13.5, color: "#5A5566" }}>{longDate(Date.now())}</div>
            </div>

            {!isFav && (
              <div data-scroll="1" style={{ display: "flex", gap: 7, alignItems: "center", padding: "13px 16px 3px", margin: "0 -16px" }}>
                {scopes.map((s) => (
                  <button
                    key={s.key}
                    onClick={s.go}
                    style={{
                      border: "1px solid " + (s.on ? "#141218" : s.n ? "#C4C4C0" : "#D4D4CF"), background: s.on ? "#141218" : "#FFFFFF",
                      color: s.on ? "#FFFFFF" : s.n ? "#C24A00" : "#545454", padding: "9px 14px", borderRadius: 19, fontSize: 14,
                      fontWeight: s.on || s.n ? 600 : 500, whiteSpace: "nowrap", flex: "none", minHeight: 40,
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {isOrder && !isFav && !q && !S.cat && (
              <div style={{ display: "flex", alignItems: "center", gap: 1, marginTop: 12, justifyContent: "flex-end" }}>
                <div style={{ display: "flex", gap: 1, border: "1px solid #C7C7C2", borderRadius: 7, overflow: "hidden" }}>
                  {([["list", t.viewList], ["grid", t.viewGrid]] as const).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => set({ view: v, cat: null, expanded: null })}
                      style={{ border: 0, padding: "0 14px", minHeight: 38, fontSize: 13, fontWeight: S.view === v ? 600 : 500, background: S.view === v ? "#141218" : "#FFFFFF", color: S.view === v ? "#FFFFFF" : "#545454", whiteSpace: "nowrap" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div
              id="name-field"
              style={{
                display: "flex", alignItems: "center", gap: 10, marginTop: 13, padding: "12px 15px", background: S.nameErr ? "#FFF5F5" : "#FFFFFF",
                border: S.nameErr ? "2px solid #D93636" : "1px solid #E0E0DB", borderRadius: 9, minHeight: 52, transition: "border-color .15s,background .15s", boxShadow: shadowCard,
              }}
            >
              <label htmlFor="author" style={{ fontSize: 13.5, color: S.nameErr ? "#B42318" : "#5A5566", fontWeight: S.nameErr ? 700 : 400, flex: "none" }}>{t.yourName}</label>
              <input
                id="author"
                ref={nameRef}
                value={S.author}
                onChange={(e) => set({ author: e.target.value, nameErr: S.nameErr && !String(e.target.value).trim() })}
                placeholder={t.namePh}
                autoComplete="off"
                style={{ flex: 1, minWidth: 60, border: 0, background: "transparent", fontSize: 16, fontWeight: 600, padding: 0 }}
              />
            </div>

            {order && (
              <div style={{ marginTop: 10, padding: "12px 15px", background: "#FFF1E3", border: "1px solid #FFC489", borderRadius: 9, fontSize: 13.5, color: "#8A3F00", lineHeight: 1.45 }}>{t.alreadySent}</div>
            )}

            {showGridMode && catCards.length > 0 && (
              <>
                <SectionHead name={t.categories} pad="24px 2px 10px" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 10 }}>
                  {catCards.map((c) => (
                    <button
                      key={c.raw}
                      onClick={() => set({ cat: c.raw, expanded: null })}
                      style={{
                        textAlign: "left", border: "1px solid " + (c.picked ? "#F2622A" : "#E0E0DB"), background: c.picked ? "#FFF1E3" : "#FFFFFF", borderRadius: 10,
                        boxShadow: "0 1px 2px rgba(23,26,31,0.04),0 4px 10px -6px rgba(23,26,31,0.12)", padding: "14px 13px", display: "flex", flexDirection: "column", gap: 8, minHeight: 104,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, width: "100%" }}>
                        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.016em", lineHeight: 1.22, flex: 1, minWidth: 0 }}>{c.name}</div>
                        {c.picked > 0 && <div style={{ ...tab, fontSize: 12, fontWeight: 600, background: "#F2622A", color: "#FFFFFF", padding: "2px 7px", borderRadius: 5, flex: "none" }}>+{c.picked}</div>}
                      </div>
                      <div style={{ flex: 1 }} />
                      <div style={{ ...tab, fontSize: 11, color: "#5A5566", lineHeight: 1.3 }}>{c.count}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {S.cat && (
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 18, paddingBottom: 9, borderBottom: "2px solid #141218" }}>
                <button onClick={() => set({ cat: null, expanded: null })} style={{ border: "1px solid #E0E0DB", background: "#FFFFFF", borderRadius: 8, minHeight: 40, padding: "0 13px 0 10px", display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                  <span style={{ fontSize: 15, color: "#5A5566", lineHeight: 1 }}>‹</span>
                  <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{t.backAll}</span>
                </button>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, minWidth: 0 }}>{catLabel(S.cat)}</div>
              </div>
            )}

            {orderGroups.map((g) => (
              <div key={g.name}>
                <SectionHead name={g.name} meta={g.meta} />
                <div style={{ background: "#FFFFFF", border: "1px solid #E0E0DB", borderRadius: 9, overflow: "hidden", boxShadow: shadowCard }}>
                  {g.items.map((it, i) => renderRow(it, i, g.items))}
                </div>
              </div>
            ))}

            {isOrder && !isFav && orderGroups.length > 0 && (
              <div style={{ padding: "11px 4px 0", fontSize: 12.5, color: "#606060", lineHeight: 1.45 }}>{t.swipeHint}</div>
            )}

            {isOrder && !isFav && hiddenHere.length > 0 && (
              <>
                <div style={{ marginTop: 14, padding: "12px 14px", background: "#F7F7F5", border: "1px solid #E0E0DB", borderRadius: 9, boxShadow: shadowCard, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "#5A5566" }}>{hiddenHere.length} {t.hiddenN}</div>
                  <button onClick={() => set((s) => ({ showHidden: !s.showHidden }))} style={{ border: "1px solid #C7C7C2", background: "#FFFFFF", padding: "0 14px", minHeight: 40, borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {S.showHidden ? t.hideHidden : t.showHidden}
                  </button>
                </div>
                {S.showHidden &&
                  hiddenHere.map((h) => (
                    <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#FFFFFF", border: "1px solid #E0E0DB", borderTop: 0, minHeight: 56, boxShadow: shadowCard }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 15, color: "#5A5566" }}>{nameOf(h)}</div>
                      <button onClick={() => setPref(h.id, { hidden: false })} style={{ border: "1px solid #141218", background: "#FFFFFF", padding: "0 14px", minHeight: 40, borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{t.restore}</button>
                    </div>
                  ))}
              </>
            )}

            {isFav && !orderGroups.length && (
              <div style={{ marginTop: 18, padding: "44px 22px", textAlign: "center", background: "#FFFFFF", border: "1px solid #E0E0DB", borderRadius: 11, boxShadow: "0 1px 2px rgba(23,26,31,0.05),0 8px 20px -12px rgba(23,26,31,0.18)" }}>
                <div style={{ fontSize: 26, lineHeight: 1, color: "#C24A00" }}>☆</div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 12 }}>{t.favEmpty}</div>
                <div style={{ fontSize: 14, color: "#5A5566", marginTop: 8, lineHeight: 1.5 }}>{t.favEmptyHint}</div>
              </div>
            )}

            {isOrder && !!q && !orderGroups.length && (
              <div style={{ marginTop: 20, padding: "44px 20px", textAlign: "center", border: "1px dashed #C7C7C2", borderRadius: 9, color: "#5A5566", fontSize: 15 }}>{t.noResults}</div>
            )}

            {!isFav && (
              <>
                <SectionHead name={t.addCustom} pad="26px 2px 8px" />
                <div style={{ display: "flex", gap: 9, alignItems: "center", background: "#FFFFFF", border: "1px solid #E0E0DB", borderRadius: 9, padding: "9px 10px", boxShadow: shadowCard }}>
                  <input
                    value={S.newItem}
                    onChange={(e) => set({ newItem: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
                    placeholder={t.customPh}
                    style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", fontSize: 16, padding: "11px 4px" }}
                  />
                  <button onClick={addCustomItem} style={{ border: 0, background: "#141218", color: "#FFFFFF", fontSize: 14.5, fontWeight: 600, padding: "0 20px", minHeight: 46, borderRadius: 8, opacity: S.newItem.trim() ? 1 : 0.4, whiteSpace: "nowrap" }}>{t.add}</button>
                </div>
              </>
            )}
            <div style={{ height: 28 }} />
          </div>
        )}

        {/* BUY */}
        {isBuy && (
          <div style={{ width: "100%", padding: "0 16px" }}>
            {!order ? (
              <div style={{ marginTop: 40, padding: "52px 22px", textAlign: "center", background: "#FFFFFF", border: "1px solid #E0E0DB", borderRadius: 11, boxShadow: shadowCard }}>
                <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.022em" }}>{t.nothingSent}</div>
                <div style={{ fontSize: 14.5, color: "#5A5566", marginTop: 9, lineHeight: 1.5 }}>{t.nothingSentHint}</div>
              </div>
            ) : (
              <>
                <div style={{ padding: "20px 0 0" }}>
                  <h1 style={{ margin: 0, fontSize: 27, fontWeight: 700, letterSpacing: "-0.028em", lineHeight: 1 }}>{t.buying}</h1>
                  <div style={{ fontSize: 13.5, color: "#5A5566", marginTop: 7, lineHeight: 1.45 }}>
                    {t.sent} {fmt(order.at)} · {t.by} {order.by} · {doneCount}/{allIds.length} {t.ordered}
                  </div>
                </div>
                <div data-printonly="1" style={{ borderBottom: "2px solid #141218", paddingBottom: 8, marginTop: 14 }}>
                  <div style={{ ...tab, fontSize: 14, fontWeight: 600, letterSpacing: "0.12em" }}>
                    SKJÓL <span style={{ letterSpacing: "0.08em", color: "#C24A00" }}>App</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#5A5566", marginTop: 4 }}>{longDate(Date.now())}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 9, marginTop: 16 }}>
                  {srcKeys.map((sid) => {
                    const s = shopById(sid);
                    const rows = bySrc[sid], doneN = rows.filter((id) => order.lines[id].done).length;
                    const on = sid === pinned, all = doneN === rows.length;
                    return (
                      <button
                        key={sid}
                        onClick={() => {
                          set((st) => ({ buySrc: st.buySrc === sid ? null : sid }));
                          setTimeout(() => {
                            const el = document.getElementById("buy-list");
                            if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 110, behavior: "smooth" });
                          }, 30);
                        }}
                        style={{
                          textAlign: "left", border: "1.5px solid " + (on ? "#141218" : all ? "#E0E0DB" : "#C9480F"),
                          background: all ? "#F1F1EF" : "linear-gradient(180deg,#F57A45 0%,#E0531C 100%)", borderRadius: 10,
                          boxShadow: all ? "0 1px 2px rgba(23,26,31,0.06)" : "0 1px 0 rgba(255,255,255,0.25) inset, 0 -2px 0 rgba(0,0,0,0.12) inset, 0 2px 4px rgba(180,70,20,0.25), 0 10px 22px -8px rgba(180,70,20,0.45)",
                          padding: "13px 13px 12px", display: "flex", flexDirection: "column", gap: 10, minHeight: 96,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, width: "100%" }}>
                          <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.014em", flex: 1, minWidth: 0, lineHeight: 1.2, color: all ? "#4A4850" : "#FFFFFF" }}>{s?.name || sid}</div>
                          <div style={{ ...tab, fontSize: 14, fontWeight: 600, color: all ? "#6E6B75" : "#FFFFFF" }}>{rows.length - doneN}/{rows.length}</div>
                        </div>
                        <div style={{ flex: 1 }} />
                        <div style={{ width: "100%", height: 4, background: all ? "#E0E0DB" : "rgba(255,255,255,0.28)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: 4, background: all ? "#A8A5AE" : "#FFFFFF", width: Math.round((doneN / rows.length) * 100) + "%" }} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: all ? "#6E6B75" : "#FFF0E6" }}>{all ? t.done : rows.length - doneN + " " + t.left}</div>
                      </button>
                    );
                  })}
                </div>

                <div id="buy-list" data-noprint="1" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
                  <div style={{ flex: 1 }} />
                  <div style={{ display: "flex", gap: 1, border: "1px solid #C7C7C2", borderRadius: 7, overflow: "hidden" }}>
                    {([["todo", t.remaining], ["all", t.all], ["done", t.done]] as const).map(([f, label]) => (
                      <button
                        key={f}
                        onClick={() => set({ filter: f })}
                        style={{ border: 0, padding: "0 13px", minHeight: 40, fontSize: 13.5, fontWeight: S.filter === f ? 600 : 500, background: S.filter === f ? "#141218" : "#FFFFFF", color: S.filter === f ? "#FFFFFF" : "#545454", whiteSpace: "nowrap" }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {shopSeq.map((sid) => {
                  const asrc = shopById(sid) || { name: "—", url: null, known: true };
                  const all = bySrc[sid], left = all.filter((id) => !order.lines[id].done).length;
                  const rows = all.filter((id) => {
                    const d = !!order.lines[id].done;
                    return S.filter === "todo" ? !d : S.filter === "done" ? d : true;
                  });
                  const map = new Map<string, string[]>();
                  rows.forEach((id) => {
                    const it = item(id)!;
                    const k = S.groupSupplier && !asrc.known ? order.lines[id].supplier || t.unassigned : catLabel(it.cat);
                    if (!map.has(k)) map.set(k, []);
                    map.get(k)!.push(id);
                  });
                  return (
                    <div key={sid}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 26, paddingBottom: 9, borderBottom: "2px solid " + (sid === pinned ? "#F2622A" : "#141218") }}>
                        <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: "-0.022em" }}>{asrc.name}</h2>
                        <span style={{ ...tab, fontSize: 12.5, fontWeight: 700, color: left ? "#FFFFFF" : "#6E6B75", background: left ? "#F2622A" : "#F1F1EF", padding: "3px 8px", borderRadius: 5 }}>{left}/{all.length}</span>
                        <div style={{ flex: 1 }} />
                        {asrc.url && (
                          <a href={asrc.url} target="_blank" rel="noopener noreferrer" data-noprint="1" style={{ fontSize: 13.5, fontWeight: 600, color: "#C24A00" }}>{t.openShop} →</a>
                        )}
                        {!asrc.known && (
                          <button
                            onClick={() => set((s) => ({ groupSupplier: !s.groupSupplier }))}
                            data-noprint="1"
                            style={{ border: "1px solid #C7C7C2", background: "transparent", padding: "0 12px", minHeight: 38, borderRadius: 8, fontSize: 13, fontWeight: 500, color: S.groupSupplier ? "#F2622A" : "#545454" }}
                          >
                            {S.groupSupplier ? t.groupedSup : t.groupSup}
                          </button>
                        )}
                      </div>
                      {!map.size && (
                        <div style={{ marginTop: 14, padding: 18, textAlign: "center", background: "#F1F1EF", borderRadius: 9, fontSize: 14, fontWeight: 600, color: "#6E6B75" }}>✓ {t.allBought}</div>
                      )}
                      {[...map.entries()].map(([gname, list]) => (
                        <div key={gname}>
                          <SectionHead name={gname} meta={String(list.length)} pad="16px 2px 8px" />
                          <div style={{ background: "#FFFFFF", border: "1px solid #E0E0DB", borderRadius: 9, overflow: "hidden", boxShadow: shadowCard }}>
                            {list.map((id, i) => {
                              const it = item(id)!, l = order.lines[id], d = !!l.done;
                              const subs: string[] = [];
                              if (it.hint) subs.push(it.hint);
                              if (l.note) subs.push(l.note);
                              if (l.by) subs.push(t.by + " " + l.by);
                              return (
                                <div key={id} style={{ borderBottom: i === list.length - 1 ? "none" : "1px solid #E9E9E5", background: d ? "#F4F4F2" : "transparent" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 13px", minHeight: 64 }}>
                                    <div style={{ ...tab, flex: "none", minWidth: 52, textAlign: "left", fontSize: 19, fontWeight: 600, color: d ? "#606060" : "#141218", lineHeight: 1.1 }}>
                                      {l.qty}
                                      <div style={{ fontSize: 12, fontWeight: 400, color: "#5A5566", marginTop: 2 }}>{unitLabel(l.unit)}</div>
                                    </div>
                                    <div onClick={() => toggleDone(id)} style={{ flex: 1, minWidth: 0, cursor: "pointer", padding: "3px 0" }}>
                                      <div style={{ fontSize: 16.5, letterSpacing: "-0.014em", fontWeight: 500, lineHeight: 1.25, textDecoration: d ? "line-through" : "none", color: d ? "#606060" : "#141218" }}>{nameOf(it)}</div>
                                      {subs.length > 0 && <div style={{ fontSize: 12.5, color: "#5A5566", marginTop: 3, lineHeight: 1.35 }}>{subs.join(" · ")}</div>}
                                    </div>
                                    <button
                                      onClick={() => toggleDone(id)}
                                      aria-label={nameOf(it)}
                                      aria-pressed={d}
                                      style={{
                                        flex: "none", width: 34, height: 34, borderRadius: 8, border: "1.5px solid " + (d ? "#6E6B75" : "#B4B4AF"), background: d ? "#6E6B75" : "#fff",
                                        color: "#FFFFFF", fontSize: 18, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                                      }}
                                    >
                                      {d ? "✓" : ""}
                                    </button>
                                  </div>
                                  {!asrc.known && (
                                    <div style={{ padding: "0 59px 12px 77px" }}>
                                      <input
                                        value={l.supplier || ""}
                                        onChange={(e) => store.upsert("lines", [{ ...l, supplier: e.target.value }], 400)}
                                        list="suppliers"
                                        placeholder={t.supplier}
                                        style={{ width: "100%", border: "1px solid #E0E0DB", background: "#fff", borderRadius: 8, padding: "11px 12px", fontSize: 16 }}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                <datalist id="suppliers">
                  {supplierOptions.map((s) => <option key={s} value={s} />)}
                </datalist>

                <div data-noprint="1" style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 22 }}>
                  <button
                    onClick={complete}
                    style={{ flex: "1 1 100%", border: 0, background: "#FF7A18", color: "#1C0D02", padding: "10px 18px", minHeight: 56, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, boxShadow: "0 1px 0 rgba(255,255,255,0.3) inset,0 6px 16px -6px rgba(200,80,10,0.5)" }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{t.allOrdered}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>{t.toHistory}</span>
                  </button>
                  <button onClick={() => window.print()} style={{ flex: 1, minWidth: 100, border: "1px solid #C7C7C2", background: "transparent", padding: "0 14px", minHeight: 46, borderRadius: 8, fontSize: 14, fontWeight: 500 }}>{t.print}</button>
                  <button onClick={share} style={{ flex: 1, minWidth: 100, border: "1px solid #C7C7C2", background: "transparent", padding: "0 14px", minHeight: 46, borderRadius: 8, fontSize: 14, fontWeight: 500 }}>{t.shareLink}</button>
                </div>
                <div style={{ height: 28 }} />
              </>
            )}
          </div>
        )}

        {/* HISTORY */}
        {isHistory && (
          <div style={{ width: "100%", padding: "0 16px" }}>
            <div style={{ padding: "20px 0 16px" }}>
              <h1 style={{ margin: 0, fontSize: 27, fontWeight: 700, letterSpacing: "-0.028em", lineHeight: 1 }}>{t.history}</h1>
            </div>
            {!history.length && (
              <div style={{ padding: "48px 22px", textAlign: "center", background: "#FFFFFF", border: "1px solid #E0E0DB", borderRadius: 11, boxShadow: shadowCard, color: "#5A5566", fontSize: 15 }}>{t.noHistory}</div>
            )}
            {history.map((h) => {
              const srcs = Array.from(new Set(h.lines.map((l) => l.srcName)));
              const open = S.openHist === h.id;
              return (
                <div key={h.id} style={{ background: "#FFFFFF", border: "1px solid #E0E0DB", borderRadius: 9, marginBottom: 10, overflow: "hidden", boxShadow: shadowCard }}>
                  <div onClick={() => set((s) => ({ openHist: s.openHist === h.id ? null : h.id }))} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, cursor: "pointer", minHeight: 64 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.014em" }}>{plural(h.lines.length, t.item, t.items)} · {plural(srcs.length, t.shop, t.shops)}</div>
                      <div style={{ fontSize: 12.5, color: "#5A5566", marginTop: 4, lineHeight: 1.4 }}>{fmt(h.closed_at)} · {t.by} {h.by} · {srcs.join(", ")}</div>
                    </div>
                    <div style={{ color: "#606060", fontSize: 15, padding: 4, flex: "none" }}>{open ? "▴" : "▾"}</div>
                  </div>
                  {open && (
                    <div style={{ borderTop: "1px solid #E4E4E0", background: "#F7F7F5" }}>
                      {h.lines.map((l) => (
                        <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "10px 14px", borderBottom: "1px solid #E9E9E5", fontSize: 15 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>{l.name}</div>
                          <div style={{ ...tab, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#606060" }}>{l.srcName}</div>
                          <div style={{ ...tab, fontWeight: 600, minWidth: 64, textAlign: "right" }}>{l.qty} {unitLabel(l.unit)}</div>
                        </div>
                      ))}
                      {isEntry && (
                        <div style={{ padding: "12px 14px" }}>
                          <button onClick={() => repeat(h.lines)} style={{ width: "100%", border: "1px solid #141218", background: "transparent", fontSize: 14.5, fontWeight: 600, minHeight: 46, borderRadius: 8 }}>{t.repeat}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ height: 28 }} />
          </div>
        )}

        {/* SEND BAR */}
        {isOrder && (
          <div data-noprint="1" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 35, background: "#141218", color: "#FFFFFF", boxShadow: "0 -4px 12px -4px rgba(23,26,31,0.18),0 -18px 40px -16px rgba(23,26,31,0.40)", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div style={{ width: "100%", padding: "11px 16px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...tab, fontSize: 15, fontWeight: 600, whiteSpace: "pre" }}>
                  {draftIds.length ? plural(draftIds.length, t.item, t.items) + "  ·  " + plural(draftSrcs.size, t.shop, t.shops) : t.emptyDraft}
                </div>
                <div style={{ fontSize: 12.5, color: "#AFA9BE", marginTop: 3 }}>{!draftIds.length ? t.emptyHint : hasName ? t.sendFrom + " " + S.author : t.sendHint}</div>
              </div>
              <button
                onClick={send}
                style={{ border: 0, background: hasName && draftIds.length ? "#FF7A18" : "#2A2830", color: hasName && draftIds.length ? "#1C0D02" : "#8A84A0", fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", padding: "0 28px", minHeight: 52, borderRadius: 9, flex: "none" }}
              >
                {t.send}
              </button>
            </div>
          </div>
        )}

        {/* BUY BAR */}
        {isBuy && order && (
          <div data-noprint="1" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 35, background: "rgba(20,18,24,0.94)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", color: "#FFFFFF", boxShadow: "0 -10px 30px -12px rgba(23,26,31,0.45)", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div style={{ height: 3, background: "rgba(255,255,255,0.12)" }}>
              <div style={{ height: 3, background: "#FF7A18", width: (allIds.length ? Math.round((doneCount / allIds.length) * 100) : 0) + "%", transition: "width .25s ease" }} />
            </div>
            <div style={{ width: "100%", padding: "11px 16px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ ...tab, flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600 }}>{doneCount} / {allIds.length} {t.ordered}</div>
              <button onClick={complete} style={{ border: 0, background: "#FF7A18", color: "#1C0D02", fontSize: 15, fontWeight: 700, padding: "0 20px", minHeight: 48, borderRadius: 9, flex: "none", whiteSpace: "nowrap" }}>{t.allOrdered}</button>
            </div>
          </div>
        )}

        {/* NAME PROMPT */}
        {npOpen && (
          <div data-noprint="1" style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(28,28,30,0.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "max(10vh,env(safe-area-inset-top)) 16px 16px" }}>
            <div role="dialog" aria-modal="true" aria-labelledby="np-title" style={{ width: "100%", maxWidth: 440, background: "#FFFFFF", borderRadius: 22, padding: "24px 20px 18px", boxShadow: "0 24px 60px -20px rgba(0,0,0,0.45)", animation: "rise .18s ease" }}>
              <div id="np-title" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em", color: "#2E2C33", lineHeight: 1.15 }}>{t.npTitle}</div>
              <div style={{ fontSize: 15, color: "#6C6C70", marginTop: 8, lineHeight: 1.45, textWrap: "pretty" }}>{t.npSub}</div>
              <div style={{ marginTop: 18, display: "flex", alignItems: "center", background: "#F2F2F7", borderRadius: 12, padding: "0 14px", height: 54, border: "2px solid #FF7A18" }}>
                <input
                  ref={npRef}
                  value={S.author}
                  onChange={(e) => set({ author: e.target.value, nameErr: false })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && hasName) {
                      e.preventDefault();
                      set({ namePrompt: false, nameErr: false });
                    }
                  }}
                  placeholder={t.yourName}
                  aria-label={t.yourName}
                  autoComplete="off"
                  enterKeyHint="done"
                  style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", fontSize: 18, fontWeight: 600, color: "#2E2C33", padding: 0 }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => set({ namePrompt: false, role: null, author: "" })} style={{ border: 0, background: "#F2F2F7", color: "#2E2C33", fontSize: 16, fontWeight: 600, minHeight: 52, padding: "0 18px", borderRadius: 12 }}>{t.npBack}</button>
                <button
                  onClick={() => (hasName ? set({ namePrompt: false, nameErr: false }) : npRef.current?.focus())}
                  style={{ flex: 1, border: 0, background: hasName ? "#FF7A18" : "#E5E5EA", color: hasName ? "#1C0D02" : "#8E8E93", fontSize: 16, fontWeight: 700, minHeight: 52, borderRadius: 12, transition: "background .15s" }}
                >
                  {t.npGo}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FABs + sheets */}
        <div data-noprint="1">
          {fabOn && (
            <button
              onClick={() => {
                set((s) => ({ addOpen: true, searchOpen: false, newSrc: s.scope !== "all" ? s.scope : null, newCat: s.cat || null }));
                setTimeout(() => addRef.current?.focus(), 60);
              }}
              aria-label="Add item"
              style={{ position: "fixed", left: 16, bottom: `calc(${fabBottom}px + env(safe-area-inset-bottom))`, zIndex: 36, width: 58, height: 58, borderRadius: "50%", border: 0, background: "#FFFFFF", color: "#2E2C33", boxShadow: "0 2px 6px rgba(23,26,31,0.16),0 12px 28px -8px rgba(23,26,31,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 26, height: 26 }} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          )}
          {isOrder && !isFav && S.addOpen && (
            <div style={{ position: "fixed", left: 0, right: 0, top: 0, zIndex: 55, background: "rgba(255,255,255,0.96)", backdropFilter: "saturate(180%) blur(18px)", WebkitBackdropFilter: "saturate(180%) blur(18px)", boxShadow: "0 8px 24px -10px rgba(23,26,31,0.3)", padding: "calc(12px + env(safe-area-inset-top)) 14px 14px", animation: "rise .15s ease" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6C6C70", padding: "0 2px 8px" }}>{t.addCustom}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", background: "#F2F2F7", borderRadius: 11, padding: "0 12px", height: 48 }}>
                  <input
                    ref={addRef}
                    value={S.newItem}
                    onChange={(e) => set({ newItem: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomItem();
                      }
                    }}
                    placeholder={t.customPh}
                    style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", fontSize: 17, padding: 0 }}
                  />
                </div>
                <button onClick={addCustomItem} style={{ border: 0, background: "#FF7A18", color: "#1C0D02", fontSize: 15, fontWeight: 700, padding: "0 18px", minHeight: 48, borderRadius: 11, opacity: S.newItem.trim() ? 1 : 0.4, whiteSpace: "nowrap" }}>{t.add}</button>
                <button onClick={() => set({ addOpen: false })} style={{ border: 0, background: "transparent", color: "#6C6C70", fontSize: 15, fontWeight: 600, padding: "0 4px", minHeight: 44 }}>{t.cancel}</button>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6C6C70", padding: "14px 2px 7px" }}>{t.pickShop}</div>
              <div data-scroll="1" style={{ display: "flex", gap: 7, margin: "0 -14px", padding: "0 14px 2px" }}>
                {[{ id: null as string | null, label: t.unknownShop }].concat(allowedShops.map((x) => ({ id: x.id, label: x.name }))).map((o) => {
                  const on = (S.newSrc || null) === o.id;
                  return (
                    <button key={o.id || "none"} onClick={() => set({ newSrc: o.id })} style={{ flex: "none", border: "1px solid " + (on ? "#2E2C33" : "#DCDCE0"), background: on ? "#2E2C33" : "#FFFFFF", color: on ? "#FFFFFF" : "#2E2C33", padding: "0 14px", minHeight: 40, borderRadius: 20, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6C6C70", padding: "14px 2px 7px" }}>{t.pickCat}</div>
              <div data-scroll="1" style={{ display: "flex", gap: 7, margin: "0 -14px", padding: "0 14px 2px" }}>
                {addCats.map((nm) => {
                  const on = (S.newCat || "Other") === nm;
                  return (
                    <button key={nm} onClick={() => set({ newCat: nm })} style={{ flex: "none", border: "1px solid " + (on ? "#FF7A18" : "#DCDCE0"), background: on ? "#FF7A18" : "#FFFFFF", color: on ? "#1C0D02" : "#2E2C33", padding: "0 14px", minHeight: 40, borderRadius: 20, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {catLabel(nm)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {fabOn && (
            <button
              onClick={() => {
                set({ searchOpen: true, addOpen: false });
                setTimeout(() => searchRef.current?.focus(), 60);
              }}
              aria-label="Search"
              style={{ position: "fixed", right: 16, bottom: `calc(${fabBottom}px + env(safe-area-inset-bottom))`, zIndex: 36, width: 58, height: 58, borderRadius: "50%", border: 0, background: "#FFFFFF", boxShadow: "0 2px 6px rgba(23,26,31,0.16),0 12px 28px -8px rgba(23,26,31,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
            >
              <span style={{ position: "relative", width: 20, height: 20, display: "block" }}>
                <span style={{ position: "absolute", left: 0, top: 0, width: 14, height: 14, border: "2.4px solid #2E2C33", borderRadius: "50%", boxSizing: "border-box" }} />
                <span style={{ position: "absolute", left: 12, top: 12, width: 8, height: 2.6, background: "#2E2C33", borderRadius: 2, transform: "rotate(45deg)", transformOrigin: "0 50%" }} />
              </span>
              {S.query && <span style={{ position: "absolute", top: 10, right: 10, width: 10, height: 10, borderRadius: "50%", background: "#F2622A", border: "2px solid #FFFFFF" }} />}
            </button>
          )}
          {isOrder && !isFav && S.searchOpen && (
            <div style={{ position: "fixed", left: 0, right: 0, top: 0, zIndex: 55, background: "rgba(255,255,255,0.94)", backdropFilter: "saturate(180%) blur(18px)", WebkitBackdropFilter: "saturate(180%) blur(18px)", boxShadow: "0 8px 24px -10px rgba(23,26,31,0.3)", padding: "calc(12px + env(safe-area-inset-top)) 14px 12px", display: "flex", alignItems: "center", gap: 10, animation: "rise .15s ease" }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, background: "#F2F2F7", borderRadius: 11, padding: "0 12px", height: 46 }}>
                <div style={{ width: 14, height: 14, border: "2px solid #8E8E93", borderRadius: "50%", flex: "none" }} />
                <input
                  ref={searchRef}
                  value={S.query}
                  onChange={(e) => set({ query: e.target.value, cat: null })}
                  onKeyDown={(e) => e.key === "Enter" && set({ searchOpen: false })}
                  placeholder={t.search}
                  type="search"
                  enterKeyHint="search"
                  style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", fontSize: 17, padding: 0 }}
                />
                {S.query && <button onClick={() => set({ query: "" })} aria-label="Clear" style={{ border: 0, background: "transparent", color: "#8E8E93", fontSize: 20, padding: "0 2px" }}>×</button>}
              </div>
              <button onClick={() => set({ searchOpen: false })} style={{ border: 0, background: "transparent", color: "#C24A00", fontSize: 16, fontWeight: 600, padding: "0 4px", minHeight: 44 }}>{t.done}</button>
            </div>
          )}
        </div>

        {S.toast && (
          <div role="status" style={{ position: "fixed", left: 0, right: 0, margin: "0 auto", width: "fit-content", bottom: "calc(98px + env(safe-area-inset-bottom))", zIndex: 40, background: "#141218", color: "#FFFFFF", fontSize: 14.5, fontWeight: 500, padding: "13px 22px", borderRadius: 9, boxShadow: "0 4px 10px rgba(23,26,31,0.22),0 18px 40px -14px rgba(23,26,31,0.45)", animation: "rise .16s ease", maxWidth: "88vw", textAlign: "center" }}>
            {S.toast}
          </div>
        )}
      </div>
    </div>
  );
}
