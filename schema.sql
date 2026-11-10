-- Heimatinventur: einmal im Supabase SQL Editor ausführen (Run).
-- 1) E-MAILS ANPASSEN: unten bei "insert into public.members" eure drei Adressen eintragen.

create table if not exists public.docs (
  path text primary key,
  col text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists docs_col_idx on public.docs (col);

create table if not exists public.members (
  email text primary key
);

alter table public.docs enable row level security;
alter table public.members enable row level security;

-- Nur freigeschaltete Mitglieder dürfen lesen und schreiben
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.email = lower(auth.jwt() ->> 'email'));
$$;

drop policy if exists "members read write" on public.docs;
create policy "members read write" on public.docs
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "see own membership" on public.members;
create policy "see own membership" on public.members
  for select to authenticated using (email = lower(auth.jwt() ->> 'email'));

-- Live-Aktualisierung zwischen den Handys
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 2) Wer darf rein? (klein geschrieben)
insert into public.members (email) values
  ('DEINE-EMAIL@beispiel.de')
  -- ,('mama@beispiel.de')
  -- ,('bruder@beispiel.de')
on conflict do nothing;

-- 3) Haushalte und Lagerorte übernehmen
insert into public.docs (path, col, data) values
 ('households/holbeinweg','households','{"name":"Holbeinweg","order":0}'),
 ('households/clemensstrasse','households','{"name":"Clemensstraße","order":1}'),
 ('households/gruenewaldweg','households','{"name":"Grünewaldweg","order":2}'),
 ('locations/hw-ks-kueche','locations','{"hh":"holbeinweg","kind":"fridge","name":"Kühlschrank Küche","order":0,"parent":null}'),
 ('locations/hw-ks-schuhe','locations','{"hh":"holbeinweg","kind":"fridge","name":"Kühlschrank bei den Schuhen","order":1,"parent":null}'),
 ('locations/hw-gt-links','locations','{"hh":"holbeinweg","kind":"freezer","name":"Gefriertruhe groß links","order":2,"parent":null}'),
 ('locations/hw-gt-mitte','locations','{"hh":"holbeinweg","kind":"freezer","name":"Gefriertruhe groß Mitte","order":3,"parent":null}'),
 ('locations/hw-gt-rechts','locations','{"hh":"holbeinweg","kind":"freezer","name":"Gefriertruhe klein rechts","order":4,"parent":null}'),
 ('locations/hw-rondell','locations','{"hh":"holbeinweg","kind":"dry","name":"Rondell Küche","order":5,"parent":null}'),
 ('locations/hw-suess','locations','{"hh":"holbeinweg","kind":"dry","name":"Süßigkeitenschrank Küche","order":6,"parent":null}'),
 ('locations/hw-backen','locations','{"hh":"holbeinweg","kind":"dry","name":"Backsachen Küche","order":7,"parent":null}'),
 ('locations/hw-k-gt','locations','{"hh":"holbeinweg","kind":"dry","name":"Keller · Regal bei den Gefriertruhen","order":8,"parent":null}'),
 ('locations/hw-k-kueche','locations','{"hh":"holbeinweg","kind":"dry","name":"Keller · Regal Küche","order":9,"parent":null}'),
 ('locations/hw-k-ziegel','locations','{"hh":"holbeinweg","kind":"dry","name":"Keller · Regal Ziegelkeller","order":10,"parent":null}'),
 ('locations/hw-garage','locations','{"hh":"holbeinweg","kind":"drinks","name":"Garage","order":11,"parent":null}'),
 ('locations/cs-kuehlschrank','locations','{"hh":"clemensstrasse","kind":"fridge","name":"Kühlschrank","order":0,"parent":null}'),
 ('locations/cs-gefrierschublade','locations','{"hh":"clemensstrasse","kind":"freezer","name":"Gefrierschublade","order":1,"parent":null}'),
 ('locations/cs-kuechenschublade','locations','{"hh":"clemensstrasse","kind":"dry","name":"Küchenschublade","order":2,"parent":null}'),
 ('locations/cs-zimmerschrank','locations','{"hh":"clemensstrasse","kind":"dry","name":"Zimmerschrank","order":3,"parent":null}')
on conflict (path) do nothing;
