// Static catalog: shops → categories → items (seeded from the prototype's RAW array).
// Item ids are stable positional ids (`<shop>-<group>-<index>`), exactly as in the
// prototype, so edit the list only by appending — never reorder or delete entries.
import raw from "./raw.json";

export type Station = "kitchen" | "bar";
export type Role = Station | "manager";

export type Shop = {
  id: string;
  name: string;
  url: string | null;
  known: boolean;
  adhoc: boolean;
  groups: string[];
};

export type Item = {
  id: string;
  name: string;
  hint: string;
  cat: string;
  src: string;
  isCustom?: boolean;
};

type RawShop = {
  id: string;
  name: string;
  url: string | null;
  known: boolean;
  adhoc?: boolean;
  groups: [string, (string | [string, string])[]][];
};

export const UNITKEYS = ["pcs", "pack", "case", "kg", "L", "keg"] as const;
export type Unit = (typeof UNITKEYS)[number];
// Unit a new line starts with (staff mostly order whole packs).
export const DEFAULT_UNIT: Unit = "pack";
export const QUICK = [1, 2, 5, 10];

// Per-item overrides of the default unit and the quick amounts (by item id).
const ITEM_DEFAULTS: Record<string, { unit?: Unit; quick?: number[] }> = {
  "ms-0-0": { unit: "kg", quick: [30, 40, 50, 80] }, // Mozzarella (pizza)
};
export const unitFor = (id: string): Unit => ITEM_DEFAULTS[id]?.unit || DEFAULT_UNIT;
export const quickFor = (id: string): number[] => ITEM_DEFAULTS[id]?.quick || QUICK;

export const ROLESRC: Record<Station, string[]> = {
  bar: ["bar", "supplies", "other"],
  kitchen: ["garri", "ms", "mata", "farm", "bonus", "supplies", "other"],
};

export const SHOPS: Shop[] = [];
export const ITEMS: Item[] = [];
export const ITEM_BY_ID: Record<string, Item> = {};

for (const s of raw as RawShop[]) {
  SHOPS.push({
    id: s.id,
    name: s.name,
    url: s.url,
    known: s.known,
    adhoc: !!s.adhoc,
    groups: s.groups.map((g) => g[0]),
  });
  s.groups.forEach((g, gi) => {
    g[1].forEach((entry, ii) => {
      const it: Item = {
        id: `${s.id}-${gi}-${ii}`,
        name: Array.isArray(entry) ? entry[0] : entry,
        hint: Array.isArray(entry) ? entry[1] : "",
        cat: g[0],
        src: s.id,
      };
      ITEMS.push(it);
      ITEM_BY_ID[it.id] = it;
    });
  });
}

export const shopById = (id: string) => SHOPS.find((s) => s.id === id);
