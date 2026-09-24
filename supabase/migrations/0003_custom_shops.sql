-- Shops/suppliers added by staff ("+ New shop" in the Add item sheet).
create table if not exists public.custom_shops (
  id         text primary key,
  name       text not null,
  station    text not null check (station in ('kitchen', 'bar')),
  created_by text not null default '',
  created_at bigint not null
);
alter table public.custom_shops enable row level security;
drop policy if exists "app access" on public.custom_shops;
create policy "app access" on public.custom_shops for all to anon, authenticated using (true) with check (true);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'custom_shops') then
    alter publication supabase_realtime add table public.custom_shops;
  end if;
end $$;
