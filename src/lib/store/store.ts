"use client";

import { useSyncExternalStore } from "react";
import { localDriver, supabaseDriver } from "./drivers";
import { TABLES, type Driver, type TableName, type Tables } from "./types";

type Pending<T> = { row: T | null; seq: number; doneAt: number | null; waiters: (() => void)[] };

export type Snapshot = {
  [K in TableName]: Tables[K][];
} & { ready: boolean; mode: Driver["mode"]; online: boolean };

// Shared state = server rows + an optimistic overlay of local writes.
// A local write stays in the overlay until a fetch that *started after* the
// write was acknowledged comes back, so realtime refetches never flash stale data.
class Store {
  private remote = {} as { [K in TableName]: Map<string, Tables[K]> };
  private overlay = {} as { [K in TableName]: Map<string, Pending<Tables[K]>> };
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private refreshTimers = new Map<TableName, ReturnType<typeof setTimeout>>();
  private listeners = new Set<() => void>();
  private seq = 0;
  private snap: Snapshot;
  private ready = false;
  private online = true;

  constructor(private driver: Driver) {
    for (const t of TABLES) {
      (this.remote as Record<string, Map<string, unknown>>)[t] = new Map();
      (this.overlay as Record<string, Map<string, unknown>>)[t] = new Map();
    }
    this.snap = this.build();
    Promise.all(TABLES.map((t) => this.refresh(t))).then(() => {
      this.ready = true;
      this.emit();
    });
    driver.subscribe((t) => this.scheduleRefresh(t));
    const all = () => TABLES.forEach((t) => this.scheduleRefresh(t));
    window.addEventListener("focus", all);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") all();
    });
    window.addEventListener("online", all);
    // Safety net in case a realtime message is missed.
    setInterval(all, 30000);
  }

  get mode() {
    return this.driver.mode;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;

  private emit() {
    this.snap = this.build();
    this.listeners.forEach((l) => l());
  }

  private build(): Snapshot {
    const out = { ready: this.ready, mode: this.driver.mode, online: this.online } as Snapshot;
    for (const t of TABLES) {
      const merged = new Map<string, unknown>(this.remote[t]);
      this.overlay[t].forEach((p, id) => {
        if (p.row) merged.set(id, p.row);
        else merged.delete(id);
      });
      (out as Record<string, unknown>)[t] = [...merged.values()];
    }
    return out;
  }

  private scheduleRefresh(t: TableName) {
    clearTimeout(this.refreshTimers.get(t));
    this.refreshTimers.set(t, setTimeout(() => this.refresh(t), 120));
  }

  async refresh<K extends TableName>(t: K) {
    const startedAt = Date.now();
    try {
      const rows = await this.driver.fetch(t);
      this.remote[t] = new Map(rows.map((r) => [r.id, r])) as never;
      this.overlay[t].forEach((p, id) => {
        if (p.doneAt !== null && p.doneAt < startedAt) this.overlay[t].delete(id);
      });
      this.online = true;
    } catch {
      this.online = false;
    }
    this.emit();
  }

  // Both resolve once every row has reached the server (retries included).
  upsert<K extends TableName>(t: K, rows: Tables[K][], delay = 0): Promise<void> {
    const done = Promise.all(rows.map((r) => this.put(t, r.id, r, delay))).then(() => {});
    this.emit();
    return done;
  }

  remove(t: TableName, ids: string[]): Promise<void> {
    const done = Promise.all(ids.map((id) => this.put(t, id, null, 0))).then(() => {});
    this.emit();
    return done;
  }

  private put<K extends TableName>(t: K, id: string, row: Tables[K] | null, delay: number): Promise<void> {
    const seq = ++this.seq;
    const prev = this.overlay[t].get(id);
    const waiters = prev && prev.doneAt === null ? prev.waiters : [];
    const done = new Promise<void>((res) => waiters.push(res));
    this.overlay[t].set(id, { row, seq, doneAt: null, waiters });
    const key = t + "|" + id;
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => this.flush(t, id), delay));
    return done;
  }

  private async flush<K extends TableName>(t: K, id: string) {
    const p = this.overlay[t].get(id);
    if (!p) return;
    const seq = p.seq;
    try {
      if (p.row) await this.driver.upsert(t, [p.row]);
      else await this.driver.remove(t, [id]);
      const cur = this.overlay[t].get(id);
      if (cur && cur.seq === seq) {
        cur.doneAt = Date.now();
        cur.waiters.splice(0).forEach((w) => w());
      }
      this.online = true;
      if (this.driver.mode === "local") this.scheduleRefresh(t);
    } catch {
      // Offline or rejected: keep the optimistic value and retry.
      this.online = false;
      this.emit();
      const key = t + "|" + id;
      this.timers.set(key, setTimeout(() => this.flush(t, id), 4000));
    }
  }
}

let store: Store | null = null;

export function getStore(): Store {
  if (!store) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    store = new Store(url && key ? supabaseDriver(url, key) : localDriver());
  }
  return store;
}

export function useStore(): Snapshot {
  const s = getStore();
  return useSyncExternalStore(s.subscribe, s.getSnapshot, s.getSnapshot);
}
