-- Migratie 0028: audit-spoor voor correcties op een al-verkocht lot.
--
-- Een eerder verkocht lot moet achteraf corrigeerbaar zijn qua prijs, koper en
-- spotter. Voorkeur = géén stille overschrijving: de actuele waarde blijft in
-- lots staan (zo blijven alle bestaande queries/rapporten werken), maar elke
-- correctie laat een append-only spoor na.
--
-- Per gewijzigd veld wordt één rij weggeschreven met de oude en de nieuwe
-- waarde plus het tijdstip. Er is (nog) geen login, dus "wie" wordt bewust niet
-- vastgelegd — enkel het tijdstip.
--
-- old_value/new_value bevatten de ruwe waarde (bv. spotter-uuid, bedrag), terwijl
-- old_label/new_label de leesbare versie bewaren (bv. de spotter- of kopernaam)
-- zodat de historiek leesbaar blijft ook al verdwijnt de bron later.
--
-- Volledig additief: geen impact op bestaande tabellen of data.

begin;

create table lot_sale_corrections (
  id            uuid primary key default gen_random_uuid(),
  lot_id        uuid not null references lots(id) on delete cascade,
  field         text not null,        -- 'sale_price' | 'buyer' | 'spotter_id'
  old_value     text,                 -- ruwe waarde vóór correctie
  new_value     text,                 -- ruwe waarde ná correctie
  old_label     text,                 -- leesbare oude waarde (bv. kopernaam)
  new_label     text,                 -- leesbare nieuwe waarde
  corrected_at  timestamptz not null default now()
);

create index lot_sale_corrections_lot_id_idx
  on lot_sale_corrections(lot_id, corrected_at);

alter table lot_sale_corrections enable row level security;

create policy "anon read/write lot_sale_corrections"
  on lot_sale_corrections for all using (true) with check (true);

commit;
