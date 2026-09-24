-- Server-only key/value store (e.g. the hashed manager PIN). RLS on, no policies.
create table if not exists public.app_secrets (
  key        text primary key,
  value      text not null,
  updated_at bigint not null
);
alter table public.app_secrets enable row level security;

-- Optional e-shop link for shops staff added (Gústi sets it in Settings).
alter table public.custom_shops add column if not exists url text;
