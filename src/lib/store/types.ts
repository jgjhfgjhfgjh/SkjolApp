import type { Station, Unit } from "../catalog";

// A line is either a station's draft (`d:<station>:<item>`) or part of the one
// open order Gústi is buying (`s:<item>`). Sending merges drafts into `s:` lines.
export type LineRow = {
  id: string;
  station: Station;
  item_id: string;
  status: "draft" | "sent";
  qty: number;
  unit: Unit;
  note: string;
  by: string;
  at: number | null; // confirmed_at (ms) — drives "In this order" sorting
  done: boolean;
  supplier: string;
  sent_at: number | null;
  sent_by: string;
};

export type HistLine = {
  id: string;
  name: string;
  cat: string;
  src: string;
  srcName: string;
  qty: number;
  unit: string;
  note: string;
  by: string;
  done: boolean;
  station?: Station;
};

export type HistoryRow = {
  id: string;
  at: number;
  closed_at: number;
  by: string;
  lines: HistLine[];
};

export type CustomRow = {
  id: string;
  name: string;
  cat: string;
  src: string;
  created_by: string;
  created_at: number;
};

// Per-item catalog tweaks shared by everyone: rename, hide, move to another shop.
export type PrefRow = {
  id: string;
  rename: string | null;
  hidden: boolean;
  src_override: string | null;
};

export type FavRow = { id: string; station: Station; item_id: string };

export type Tables = {
  lines: LineRow;
  history: HistoryRow;
  custom_items: CustomRow;
  item_prefs: PrefRow;
  favs: FavRow;
};
export type TableName = keyof Tables;
export const TABLES: TableName[] = ["lines", "history", "custom_items", "item_prefs", "favs"];

export interface Driver {
  mode: "local" | "supabase";
  fetch<K extends TableName>(table: K): Promise<Tables[K][]>;
  upsert<K extends TableName>(table: K, rows: Tables[K][]): Promise<void>;
  remove(table: TableName, ids: string[]): Promise<void>;
  subscribe(onChange: (table: TableName) => void): () => void;
}
