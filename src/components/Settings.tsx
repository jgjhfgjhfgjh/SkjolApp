"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { Station } from "@/lib/catalog";
import type { Dict, Lang } from "@/lib/i18n";
import { managerTokenValue, saveManagerToken, type PushState } from "@/lib/push-client";
import type { CustomShopRow } from "@/lib/store/types";

// Gústi's Settings tab: PIN, notifications, own shops, hidden items, app.
const S = {
  en: {
    settings: "Settings", access: "Gústi's access", accessSub: "The 4-digit code for the To buy screen.",
    curPin: "Current PIN", newPin: "New PIN", newPin2: "New PIN again", savePin: "Save PIN", pinSaved: "PIN changed",
    pinBadCur: "Current PIN is wrong", pinMismatch: "The new PINs don't match", pinFormat: "The PIN must be 4 digits",
    pinUnavailable: "Changing the PIN needs the server keys", notif: "Notifications",
    shops: "Your own shops", shopsSub: "Shops added from the kitchen or bar. Rename, add an e-shop link, move or remove.",
    shopUrl: "E-shop link (optional)", addShop: "Add shop", shopName: "Shop name", del: "Delete", delConfirm: "Really delete?",
    shopsEmpty: "No shops added yet", shopDeleted: "Shop deleted — its items moved to Ad-hoc", saved: "Saved",
    hidden: "Hidden items", hiddenEmpty: "No hidden items", app: "App", shareInstall: "Share install link",
    openInstall: "Install page", signOut: "Sign out",
  },
  is: {
    settings: "Stillingar", access: "Aðgangur Gústa", accessSub: "4 stafa kóðinn fyrir „Að kaupa“ skjáinn.",
    curPin: "Núverandi PIN", newPin: "Nýtt PIN", newPin2: "Nýtt PIN aftur", savePin: "Vista PIN", pinSaved: "PIN breytt",
    pinBadCur: "Núverandi PIN er rangt", pinMismatch: "Nýju PIN-in passa ekki saman", pinFormat: "PIN verður að vera 4 tölustafir",
    pinUnavailable: "Til að breyta PIN þarf lykla á þjóninum", notif: "Tilkynningar",
    shops: "Eigin verslanir", shopsSub: "Verslanir sem bætt var við úr eldhúsi eða bar. Endurnefndu, bættu við vefslóð, færðu eða eyddu.",
    shopUrl: "Vefslóð verslunar (valfrjálst)", addShop: "Bæta við verslun", shopName: "Heiti verslunar", del: "Eyða", delConfirm: "Eyða í alvöru?",
    shopsEmpty: "Engar eigin verslanir enn", shopDeleted: "Verslun eytt — vörurnar fóru í Ad-hoc", saved: "Vistað",
    hidden: "Faldar vörur", hiddenEmpty: "Engar faldar vörur", app: "Appið", shareInstall: "Deila uppsetningarhlekk",
    openInstall: "Uppsetningarsíða", signOut: "Skrá út",
  },
  cs: {
    settings: "Nastavení", access: "Přístup Gústiho", accessSub: "Čtyřmístný kód pro obrazovku K nákupu.",
    curPin: "Současný PIN", newPin: "Nový PIN", newPin2: "Nový PIN znovu", savePin: "Uložit PIN", pinSaved: "PIN změněn",
    pinBadCur: "Současný PIN nesedí", pinMismatch: "Nové PINy se neshodují", pinFormat: "PIN musí mít 4 číslice",
    pinUnavailable: "Změna PINu potřebuje serverové klíče", notif: "Upozornění",
    shops: "Vlastní obchody", shopsSub: "Obchody přidané z kuchyně nebo baru. Přejmenujte, přidejte odkaz na e-shop, přesuňte nebo smažte.",
    shopUrl: "Odkaz na e-shop (nepovinné)", addShop: "Přidat obchod", shopName: "Název obchodu", del: "Smazat", delConfirm: "Opravdu smazat?",
    shopsEmpty: "Zatím žádné vlastní obchody", shopDeleted: "Obchod smazán — jeho položky jsou v Ad-hoc", saved: "Uloženo",
    hidden: "Skryté položky", hiddenEmpty: "Žádné skryté položky", app: "Aplikace", shareInstall: "Sdílet odkaz na instalaci",
    openInstall: "Stránka instalace", signOut: "Odhlásit",
  },
  pl: {
    settings: "Ustawienia", access: "Dostęp Gústiego", accessSub: "4-cyfrowy kod do ekranu „Do kupienia”.",
    curPin: "Obecny PIN", newPin: "Nowy PIN", newPin2: "Nowy PIN ponownie", savePin: "Zapisz PIN", pinSaved: "PIN zmieniony",
    pinBadCur: "Obecny PIN jest błędny", pinMismatch: "Nowe PIN-y się nie zgadzają", pinFormat: "PIN musi mieć 4 cyfry",
    pinUnavailable: "Zmiana PIN-u wymaga kluczy serwera", notif: "Powiadomienia",
    shops: "Własne sklepy", shopsSub: "Sklepy dodane z kuchni lub baru. Zmień nazwę, dodaj link do e-sklepu, przenieś lub usuń.",
    shopUrl: "Link do e-sklepu (opcjonalnie)", addShop: "Dodaj sklep", shopName: "Nazwa sklepu", del: "Usuń", delConfirm: "Na pewno usunąć?",
    shopsEmpty: "Brak własnych sklepów", shopDeleted: "Sklep usunięty — pozycje trafiły do Ad-hoc", saved: "Zapisano",
    hidden: "Ukryte pozycje", hiddenEmpty: "Brak ukrytych pozycji", app: "Aplikacja", shareInstall: "Udostępnij link instalacji",
    openInstall: "Strona instalacji", signOut: "Wyloguj",
  },
} satisfies Record<Lang, unknown>;

export const settingsTitle = (l: Lang) => S[l].settings;

const cardShadow = "0 1px 2px rgba(23,26,31,0.05),0 6px 16px -8px rgba(23,26,31,0.14)";
const card: CSSProperties = { background: "#FFFFFF", border: "1px solid #E0E0DB", borderRadius: 11, boxShadow: cardShadow, padding: "14px 14px" };
const input: CSSProperties = { width: "100%", border: "1px solid #E0E0DB", background: "#FFFFFF", borderRadius: 9, padding: "0 12px", minHeight: 46, fontSize: 16 };
const dark: CSSProperties = { border: 0, background: "#141218", color: "#FFFFFF", fontSize: 14, fontWeight: 600, padding: "0 16px", minHeight: 46, borderRadius: 9, whiteSpace: "nowrap" };
const ghost: CSSProperties = { border: "1px solid #C7C7C2", background: "#FFFFFF", color: "#2E2C33", fontSize: 13.5, fontWeight: 600, padding: "0 14px", minHeight: 42, borderRadius: 9, whiteSpace: "nowrap" };

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 2px 8px" }}>
        <h2 style={{ margin: 0, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>{title}</h2>
        <div style={{ flex: 1, height: 1, background: "#E0E0DB" }} />
      </div>
      {sub && <div style={{ fontSize: 13, color: "#6C6C70", lineHeight: 1.45, margin: "-2px 2px 10px" }}>{sub}</div>}
      {children}
    </section>
  );
}

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);
const normUrl = (v: string) => {
  const u = v.trim();
  if (!u) return null;
  return /^https?:\/\//i.test(u) ? u : "https://" + u;
};

export type HiddenItem = { id: string; name: string; shop: string };

export default function Settings(props: {
  lang: Lang;
  t: Dict;
  shops: CustomShopRow[];
  hidden: HiddenItem[];
  push: PushState;
  pushBusy: boolean;
  pushLabels: { title: string; sub: string; on: string; done: string; off: string; denied: string; install: string };
  onPush: (on: boolean) => void;
  onSaveShop: (row: CustomShopRow) => void;
  onAddShop: (name: string, station: Station) => void;
  onDeleteShop: (id: string) => void;
  onRestore: (id: string) => void;
  onShareInstall: () => void;
  onSignOut: () => void;
  flash: (m: string) => void;
}) {
  const { t, lang } = props;
  const L = S[lang];
  const [cur, setCur] = useState("");
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newStation, setNewStation] = useState<Station>("kitchen");
  const [drafts, setDrafts] = useState<Record<string, { name?: string; url?: string }>>({});

  async function savePin() {
    setPinErr("");
    if (cur.length !== 4 || n1.length !== 4) return setPinErr(L.pinFormat);
    if (n1 !== n2) return setPinErr(L.pinMismatch);
    setBusy(true);
    try {
      const r = await fetch("/api/settings/pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: managerTokenValue(), current: cur, next: n1 }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        saveManagerToken(j.token);
        setCur("");
        setN1("");
        setN2("");
        props.flash(L.pinSaved);
      } else setPinErr(j.error === "unavailable" ? L.pinUnavailable : j.error === "format" ? L.pinFormat : L.pinBadCur);
    } catch {
      setPinErr(L.pinUnavailable);
    }
    setBusy(false);
  }

  const stationName = (s: Station) => (s === "bar" ? t.bar : t.kitchen);
  const stationToggle = (value: Station, onChange: (s: Station) => void) => (
    <div style={{ display: "flex", gap: 1, border: "1px solid #C7C7C2", borderRadius: 8, overflow: "hidden", flex: "none" }}>
      {(["kitchen", "bar"] as Station[]).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          style={{ border: 0, padding: "0 12px", minHeight: 40, fontSize: 13, fontWeight: value === s ? 700 : 500, background: value === s ? "#141218" : "#FFFFFF", color: value === s ? "#FFFFFF" : "#545454" }}
        >
          {stationName(s)}
        </button>
      ))}
    </div>
  );
  const pinInput = (label: string, v: string, set: (v: string) => void, auto?: string) => (
    <label style={{ display: "block", flex: "1 1 120px" }}>
      <div style={{ fontSize: 12.5, color: "#5A5566", marginBottom: 5 }}>{label}</div>
      <input
        value={v}
        onChange={(e) => {
          set(digits(e.target.value));
          setPinErr("");
        }}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete={auto}
        style={{ ...input, letterSpacing: "0.4em", fontWeight: 700, textAlign: "center" }}
      />
    </label>
  );

  return (
    <div style={{ width: "100%", padding: "0 16px" }}>
      <div style={{ padding: "20px 0 0" }}>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 700, letterSpacing: "-0.028em", lineHeight: 1 }}>{L.settings}</h1>
      </div>

      <Section title={L.access} sub={L.accessSub}>
        <div style={card}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {pinInput(L.curPin, cur, setCur, "current-password")}
            {pinInput(L.newPin, n1, setN1, "new-password")}
            {pinInput(L.newPin2, n2, setN2, "new-password")}
          </div>
          {pinErr && <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 600, color: "#B42318" }}>{pinErr}</div>}
          <button onClick={savePin} disabled={busy} style={{ ...dark, width: "100%", marginTop: 12, background: "#FF7A18", color: "#1C0D02", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
            {L.savePin}
          </button>
        </div>
      </Section>

      {props.push !== "hidden" && (
        <Section title={L.notif}>
          <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#2E2C33" }}>{props.push === "on" ? props.pushLabels.done : props.pushLabels.title}</div>
              {props.push !== "on" && (
                <div style={{ fontSize: 13, color: "#6C6C70", marginTop: 3, lineHeight: 1.4 }}>
                  {props.push === "denied" ? props.pushLabels.denied : props.push === "needs-install" ? props.pushLabels.install : props.pushLabels.sub}
                </div>
              )}
            </div>
            {(props.push === "off" || props.push === "on") && (
              <button
                onClick={() => props.onPush(props.push === "off")}
                disabled={props.pushBusy}
                style={props.push === "off" ? { ...dark, background: "#FF7A18", color: "#1C0D02", fontWeight: 700 } : ghost}
              >
                {props.push === "off" ? props.pushLabels.on : props.pushLabels.off}
              </button>
            )}
          </div>
        </Section>
      )}

      <Section title={L.shops} sub={L.shopsSub}>
        {!props.shops.length && <div style={{ ...card, color: "#6C6C70", fontSize: 14 }}>{L.shopsEmpty}</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {props.shops.map((s) => {
            const d = drafts[s.id] || {};
            const commit = (patch: Partial<CustomShopRow>) => {
              props.onSaveShop({ ...s, ...patch });
              setDrafts((x) => {
                const n = { ...x };
                delete n[s.id];
                return n;
              });
            };
            return (
              <div key={s.id} style={{ ...card, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    value={d.name ?? s.name}
                    onChange={(e) => setDrafts((x) => ({ ...x, [s.id]: { ...x[s.id], name: e.target.value } }))}
                    onBlur={() => d.name !== undefined && d.name.trim() && d.name.trim() !== s.name && commit({ name: d.name.trim() })}
                    aria-label={L.shopName}
                    style={{ ...input, flex: "1 1 160px", width: "auto", fontWeight: 600 }}
                  />
                  {stationToggle(s.station, (st) => st !== s.station && commit({ station: st }))}
                </div>
                <input
                  value={d.url ?? s.url ?? ""}
                  onChange={(e) => setDrafts((x) => ({ ...x, [s.id]: { ...x[s.id], url: e.target.value } }))}
                  onBlur={() => d.url !== undefined && normUrl(d.url) !== (s.url || null) && commit({ url: normUrl(d.url) })}
                  placeholder={L.shopUrl}
                  inputMode="url"
                  autoCapitalize="off"
                  style={input}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => {
                      if (confirmDel === s.id) {
                        props.onDeleteShop(s.id);
                        setConfirmDel(null);
                        props.flash(L.shopDeleted);
                      } else setConfirmDel(s.id);
                    }}
                    style={{ ...ghost, borderColor: confirmDel === s.id ? "#D70015" : "#C7C7C2", background: confirmDel === s.id ? "#D70015" : "#FFFFFF", color: confirmDel === s.id ? "#FFFFFF" : "#B42318" }}
                  >
                    {confirmDel === s.id ? L.delConfirm : L.del}
                  </button>
                </div>
              </div>
            );
          })}
          <div style={{ ...card, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#F7F7F5" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  props.onAddShop(newName.trim(), newStation);
                  setNewName("");
                }
              }}
              placeholder={L.shopName}
              style={{ ...input, flex: "1 1 160px", width: "auto" }}
            />
            {stationToggle(newStation, setNewStation)}
            <button
              onClick={() => {
                if (!newName.trim()) return;
                props.onAddShop(newName.trim(), newStation);
                setNewName("");
              }}
              style={{ ...dark, opacity: newName.trim() ? 1 : 0.4 }}
            >
              {L.addShop}
            </button>
          </div>
        </div>
      </Section>

      <Section title={L.hidden}>
        {!props.hidden.length ? (
          <div style={{ ...card, color: "#6C6C70", fontSize: 14 }}>{L.hiddenEmpty}</div>
        ) : (
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            {props.hidden.map((h, i) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", minHeight: 56, borderTop: i ? "1px solid #E9E9E5" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: "#2E2C33" }}>{h.name}</div>
                  <div style={{ fontSize: 12, color: "#6C6C70", marginTop: 2 }}>{h.shop}</div>
                </div>
                <button onClick={() => props.onRestore(h.id)} style={ghost}>{t.restore}</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={L.app}>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button onClick={props.onShareInstall} style={{ ...ghost, flex: "1 1 160px", minHeight: 46 }}>{L.shareInstall}</button>
          <a href="/install" style={{ ...ghost, flex: "1 1 160px", minHeight: 46, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>{L.openInstall}</a>
          <button onClick={props.onSignOut} style={{ ...ghost, flex: "1 1 100%", minHeight: 46, color: "#B42318" }}>{L.signOut}</button>
        </div>
      </Section>
      <div style={{ height: 28 }} />
    </div>
  );
}
