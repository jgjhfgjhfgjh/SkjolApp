-- Item edit: move a catalog item to another category (like src_override does for the shop).
alter table public.item_prefs add column if not exists cat_override text;
