-- Migratie 0038: spotters per veilingdag (B2 uit ROADMAP_2026-06-30)
--
-- Doel: bij een MEERDAAGSE veiling kan de spotter-samenstelling per dag
-- verschillen. Vandaag kan `collection_spotters` maar één rij per
-- (collectie, spotter) bevatten (PK collection_id, spotter_id) — dat blokkeert
-- "dezelfde spotter op meerdere dagen". We voegen `collection_day_id` toe en
-- vervangen de composiet-PK door een surrogaat-PK, zodat één spotter meerdere
-- dag-rijen kan hebben.
--
-- Model:
--   * collection_day_id = NULL  -> "alle dagen" (backward-compatible: bestaande
--     17 rijen blijven zo en blijven op elke dag tonen).
--   * collection_day_id = <dag> -> geldt enkel voor die veilingdag.
-- Op een meerdaagse veiling beheert de UI dag-rijen; "alle dagen" wordt daar een
-- hulp-actie die uitwaaiert naar echte dag-rijen (geen onverwijderbare null-rij).
--
-- LET OP — dit is een (deels) DESTRUCTIEVE migratie: de oude PRIMARY KEY wordt
-- gedropt en vervangen. Vóór uitvoeren: Supabase-backup gemaakt
-- (snapshot-tabel collection_spotters_backup_0038, 17 rijen) + bevestiging.
-- Geverifieerd 30-06: geen enkele FK verwijst naar de oude sleutel; de oude PK
-- heet auction_spotters_pkey (na de rename in 0018). Beide mogelijke namen
-- worden met `if exists` afgevangen.

-- 1) Additief: surrogaat-id + dag-kolom (idempotent)
alter table collection_spotters
  add column if not exists id uuid not null default gen_random_uuid();

alter table collection_spotters
  add column if not exists collection_day_id uuid
  references collection_days(id) on delete cascade;

-- 2) Oude composiet-PK -> surrogaat-PK op id
alter table collection_spotters drop constraint if exists auction_spotters_pkey;
alter table collection_spotters drop constraint if exists collection_spotters_pkey;
alter table collection_spotters add constraint collection_spotters_pkey primary key (id);

-- 3) Uniek slot: hoogstens één rij per (collectie, spotter, dag).
--    De COALESCE-vervangwaarde is bewust (NIET een kale unieke sleutel): zo telt
--    NULL ("alle dagen") als één concrete waarde en kan er hoogstens één
--    "alle dagen"-rij per (collectie, spotter) bestaan. Een kale unieke index zou
--    meerdere NULL-rijen toelaten (Postgres ziet NULL <> NULL).
create unique index if not exists uq_collection_spotters_col_spot_day
  on collection_spotters (
    collection_id,
    spotter_id,
    coalesce(collection_day_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists idx_collection_spotters_day
  on collection_spotters(collection_day_id);
