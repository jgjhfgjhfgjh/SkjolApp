import { createClient } from "@supabase/supabase-js";
import { TABLES, type Driver, type TableName, type Tables } from "./types";

// Single-device fallback used when Supabase env vars are missing (dev, demo).
// Tabs of the same browser still stay in sync through the `storage` event.
export function localDriver(): Driver {
  const key = (t: TableName) => "skjol.db." + t;
  const read = <K extends TableName>(t: K): Tables[K][] => {
    try {
      return JSON.parse(localStorage.getItem(key(t)) || "[]");
    } catch {
      return [];
    }
  };
  const write = <K extends TableName>(t: K, rows: Tables[K][]) => {
    try {
      localStorage.setItem(key(t), JSON.stringify(rows));
    } catch {}
  };
  return {
    mode: "local",
    async fetch(t) {
      return read(t);
    },
    async upsert(t, rows) {
      const map = new Map(read(t).map((r) => [r.id, r]));
      rows.forEach((r) => map.set(r.id, r));
      write(t, [...map.values()]);
    },
    async remove(t, ids) {
      const drop = new Set(ids);
      write(t, read(t).filter((r) => !drop.has(r.id)));
    },
    subscribe(onChange) {
      const h = (e: StorageEvent) => {
        const t = TABLES.find((x) => e.key === key(x));
        if (t) onChange(t);
      };
      window.addEventListener("storage", h);
      return () => window.removeEventListener("storage", h);
    },
  };
}

export function supabaseDriver(url: string, anonKey: string): Driver {
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  return {
    mode: "supabase",
    async fetch(t) {
      const { data, error } = await sb.from(t).select("*").limit(5000);
      if (error) throw error;
      // Guard against numeric columns arriving as strings.
      if (t === "lines") data?.forEach((r) => (r.qty = Number(r.qty)));
      return (data || []) as never;
    },
    async upsert(t, rows) {
      if (!rows.length) return;
      const { error } = await sb.from(t).upsert(rows as never[]);
      if (error) throw error;
    },
    async remove(t, ids) {
      if (!ids.length) return;
      const { error } = await sb.from(t).delete().in("id", ids);
      if (error) throw error;
    },
    subscribe(onChange) {
      let ch = sb.channel("skjol-sync");
      for (const t of TABLES) {
        ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => onChange(t));
      }
      ch.subscribe();
      return () => {
        sb.removeChannel(ch);
      };
    },
  };
}
