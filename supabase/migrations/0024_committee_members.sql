-- Migratie 0024: comité-leden per veilinghuis.
--
-- Frederik wil per veilinghuis een comité kunnen onderhouden met leden,
-- hun functie, periode (jaar van toetreden, eventueel jaar van uittreden)
-- en foto. Centrale plek om dat overzicht bij te houden — relevant voor
-- communicatie en interne organisatie.
--
-- Foto's gebruiken dezelfde Supabase Storage bucket "client-photos" via
-- subfolder "committee/" (geen extra bucket nodig).

create table house_committee_members (
  id              uuid primary key default gen_random_uuid(),
  house_id        uuid not null references auction_houses(id) on delete cascade,
  name            text not null,
  role            text,                       -- bv. "Voorzitter", "Secretaris"
  year_joined     int,                        -- jaar van toetreden, optioneel
  year_left       int,                        -- jaar van uittreden, NULL = nog actief
  photo_url       text,                       -- Supabase Storage URL
  display_order   int not null default 0,
  created_at      timestamptz not null default now(),
  check (year_left is null or year_joined is null or year_left >= year_joined)
);

create index idx_committee_house
  on house_committee_members(house_id, display_order);

alter table house_committee_members enable row level security;

create policy "anon read/write committee_members"
  on house_committee_members for all using (true) with check (true);
