-- New lines default to packs (the app sets the unit explicitly too).
alter table public.lines alter column unit set default 'pack';
