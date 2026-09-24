-- SKJÓL goods order — shared state for all phones (kitchen, bar, Gústi).
-- Run once in the Supabase SQL editor (or `supabase db push`).
--
-- The catalog itself (shops → categories → items) ships with the app in
-- src/lib/raw.json; the database only holds what people change.
-- Timestamps are epoch milliseconds (bigint) to match the client.

-- Draft lines per station + the one open order Gústi is buying.
--   id = 'd:<station>:<item_id>' for drafts, 's:<item_id>' for sent lines.
create table if not exists public.lines (
  id        text primary key,
  station   text not null check (station in ('kitchen', 'bar')),
  item_id   text not null,
  status    text not null check (status in ('draft', 'sent')),
  qty       numeric not null check (qty > 0),
  unit      text not null default 'pcs' check (unit in ('pcs', 'pack', 'case', 'kg', 'L', 'keg')),
  note      text not null default '',
  "by"      text not null default '',
  at        bigint,              -- confirmed_at: when the line was OK'd
  done      boolean not null default false,
  supplier  text not null default '',
  sent_at   bigint,
  sent_by   text not null default ''
);

-- Finished orders ("All ordered"), with a snapshot of every line.
create table if not exists public.history (
  id        text primary key,
  at        bigint not null,
  closed_at bigint not null,
  "by"      text not null default '',
  lines     jsonb not null default '[]'::jsonb
);
create index if not exists history_closed_at on public.history (closed_at desc);

-- Items staff added themselves ("Not in the list?").
create table if not exists public.custom_items (
  id         text primary key,
  name       text not null,
  cat        text not null default 'Other',
  src        text not null default 'other',
  created_by text not null default '',
  created_at bigint not null
);

-- Shared tweaks to catalog items: rename, hide, move to another shop.
create table if not exists public.item_prefs (
  id           text primary key,   -- item id
  rename       text,
  hidden       boolean not null default false,
  src_override text
);

-- Favourites per station.
create table if not exists public.favs (
  id      text primary key,        -- '<station>:<item_id>'
  station text not null check (station in ('kitchen', 'bar')),
  item_id text not null
);

-- No per-user accounts: staff identify by typed name, the manager screen is
-- behind a PIN checked server-side. The anon key may read/write these tables.
alter table public.lines        enable row level security;
alter table public.history      enable row level security;
alter table public.custom_items enable row level security;
alter table public.item_prefs   enable row level security;
alter table public.favs         enable row level security;

do $$
declare t text;
begin
  foreach t in array array['lines', 'history', 'custom_items', 'item_prefs', 'favs'] loop
    execute format('drop policy if exists "app access" on public.%I', t);
    execute format('create policy "app access" on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Live sync between phones.
do $$
declare t text;
begin
  foreach t in array array['lines', 'history', 'custom_items', 'item_prefs', 'favs'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
