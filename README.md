# SKJÓL — Goods order

Mobile-first PWA for the SKJÓL restaurant. Kitchen and Bar record what ran out,
Gústi (manager) sees one combined list grouped by shop and ticks items off while
buying. UI in EN / IS / CS / PL; item names never translate.

Built from the design handoff `Purchasing v3.dc.html` (high fidelity).

## Stack

- Next.js (App Router) + React + TypeScript, inline styles ported 1:1 from the prototype
- Supabase (Postgres + Realtime) for live sync between phones
- PWA: `app/manifest.ts`, generated icons (`/icons/[size]`), `public/sw.js`

## Run locally

```bash
npm install
npm run dev
```

Without Supabase env vars the app runs in **offline demo** mode: data lives in
`localStorage` on one device (tabs of the same browser still sync). The gate
footer shows "offline demo" in that mode.

## Connect Supabase (shared state between phones)

1. Create a Supabase project (free tier is enough).
2. SQL editor → run `supabase/migrations/0001_init.sql`
   (tables, RLS policies, realtime publication).
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `MANAGER_PIN` — Gústi's 4-digit code (server-side only; default `1234`)
4. Set the same variables in Vercel → Project → Environment Variables.

## Data model

| table          | what                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| `lines`        | drafts per station (`d:<station>:<item>`) and the open order (`s:<item>`) |
| `history`      | finished orders with a snapshot of their lines                            |
| `custom_items` | items staff added themselves                                              |
| `item_prefs`   | shared rename / hide / move-to-shop per catalog item                      |
| `favs`         | favourites per station                                                    |

The catalog (shops → categories → items) ships with the app in
`src/lib/raw.json`. Item ids are positional (`garri-0-3`), so **only append**
to that file — reordering would re-point saved lines and history.

Writes are optimistic: the UI updates instantly, writes are retried while
offline, and every phone refetches on realtime events, focus and every 30 s.

## Security notes

There are no user accounts (by design: staff type their name per order). The
anon key can read and write the five tables, so anyone with the URL can use the
app. The manager PIN only gates the Buy screen in the UI and is checked
server-side (`/api/pin`). Keep the URL internal.
