-- Web Push subscriptions (manager devices). Server-only: RLS on, no policies,
-- so the anon key can neither read nor write; the API uses the service role.
create table if not exists public.push_subs (
  id         text primary key,          -- sha256 of the endpoint
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  role       text not null default 'manager' check (role in ('manager')),
  lang       text not null default 'en',
  created_at bigint not null
);
alter table public.push_subs enable row level security;
